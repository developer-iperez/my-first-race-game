import type { CarPhysicsConfig } from '../config/schema/car';

/**
 * Modelo de físicas arcade (no realista) descrito en docs/ANALISIS.md §3.4.
 *
 * La idea clave del derrape: la velocidad se descompone en una componente
 * hacia delante (agarre alto = "sobre raíles") y una componente lateral
 * (agarre bajo = desliza). Bajar el agarre lateral -especialmente con el
 * freno de mano- es lo que provoca el derrape.
 *
 * El giro tiene inercia real (CarState.yawRate): el volante no fija el
 * ángulo del coche de golpe cada frame, marca hacia dónde debería girar y
 * la velocidad angular se acerca a eso con un poco de retraso — sobre
 * todo mientras el coche patina. Esto es lo que hace que el contravolante
 * se note "de verdad": hay una rotación en marcha que hay que frenar y
 * revertir, no un valor que salta directo al nuevo input cada frame.
 *
 * Es una función pura: mismo estado + mismo input + mismo dt = mismo
 * resultado. Eso la hace fácil de testear y de tunear jugando, sin montar
 * ninguna escena de Phaser.
 */

export interface CarState {
  x: number;
  y: number;
  /** Radianes. 0 = mirando hacia +x. */
  angle: number;
  vx: number;
  vy: number;
  /**
   * Velocidad angular actual (rad/s). Con inercia: se acerca al objetivo
   * marcado por el volante en vez de igualarlo de golpe cada frame (ver
   * YAW_CATCH_UP_RATE). Opcional: si no se pasa, se asume igual al
   * objetivo instantáneo (coche recién creado, sin inercia de giro previa
   * que arrastrar).
   */
  yawRate?: number;
}

export interface CarInput {
  /** -1 (freno/marcha atrás) .. 1 (acelerar) */
  throttle: number;
  /** -1 (izquierda) .. 1 (derecha) */
  steer: number;
  handbrake: boolean;
}

/** Multiplicador de agarre de la superficie bajo el coche (asfalto=1, hierba<1...). */
export type SurfaceGrip = number;

/**
 * Multiplicador de resistencia al avance de la superficie bajo el coche
 * (asfalto=1, hierba>1...). A diferencia de SurfaceGrip (que solo afecta al
 * agarre lateral, es decir cuánto derrapa), esto frena la velocidad hacia
 * delante: sin esto, salirse de la pista solo hacía que el coche patinara
 * más de lado, pero seguía corriendo prácticamente igual de rápido hacia
 * donde apuntaba — el jugador podía irse fuera de la zona asfaltada y
 * mantener casi toda la velocidad indefinidamente.
 */
export type SurfaceDrag = number;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Cuánto agarre lateral como máximo se resta al girar fuerte a alta
 * velocidad (más derrape en curvas cerradas tomadas rápido). Con el
 * volante a fondo y a velocidad máxima se llega a perder esta fracción de
 * agarre; girando suave o a baja velocidad casi no afecta, así que las
 * maniobras lentas y precisas (aparcar, esquivar) no se ven penalizadas.
 */
const CORNERING_GRIP_LOSS = 0.9;
/**
 * Fracción de maxSpeed a partir de la cual girar fuerte pierde el máximo de
 * agarre lateral posible (ver CORNERING_GRIP_LOSS). Por debajo satura antes
 * de llegar a velocidad punta: así el derrape no depende de ir pegado al
 * tope de velocidad ni de mantener el acelerador a fondo en la curva (con
 * frenos fuertes, soltar gas frena mucho y sin esto el agarre se recuperaba
 * casi al instante, apagando el derrape).
 */
const CORNERING_SPEED_SATURATION = 0.7;
/** Agarre lateral mínimo garantizado, para que nunca se vuelva un patinazo sin control. */
const MIN_LATERAL_GRIP = 0.015;

/**
 * Fracción del hueco entre la velocidad angular actual y la que pide el
 * volante que se cierra cada frame a 60fps CUANDO EL COCHE TIENE BUEN
 * AGARRE (yendo derecho, sin patinar): 1 = respuesta instantánea al
 * volante (como conducir normal, sin inercia perceptible). No es un techo
 * ni un bloqueo — es cuánto "pesa" girar el morro.
 */
const YAW_CATCH_UP_RATE = 0.65;
/**
 * Cuánto reduce el agarre lateral bajo (coche ya patinando) esa misma
 * capacidad de cambiar de velocidad angular: a más derrape, más cuesta
 * redirigir el morro — como recoger un derrape de verdad, hace falta
 * sostener el volante un momento para que "muerda", en vez de saltar al
 * instante. Se aplica igual entrando o saliendo del derrape (contravolante
 * incluido): no hay ningún caso especial, solo inercia continua.
 */
const YAW_INERTIA_FROM_SLIP = 0.85;
/** Capacidad mínima de cambiar de velocidad angular incluso a patinazo completo, para que el volante nunca deje de responder del todo. */
const MIN_YAW_CATCH_UP_RATE = 0.12;

/**
 * Fracción de la potencia del motor (enginePower) que se usa al ir marcha
 * atrás, para que dé menos aceleración que hacia delante — un coche de
 * carreras acelera mucho peor en reversa. NO afecta al frenado: pisar
 * "atrás" yendo hacia delante sigue usando brakingPower (fuerte); esto solo
 * entra cuando el coche está parado o ya retrocediendo.
 */
const REVERSE_POWER_FACTOR = 0.4;

/**
 * Aplica un factor de "agarre/fricción por frame a 60fps" de forma
 * independiente del framerate real, usando dt en segundos. Se exporta para
 * que otros efectos de fricción (p.ej. frenado fuerte al salirse de pista
 * en RaceScene) usen la misma matemática en vez de reinventarla.
 */
export function frameRateIndependentDecay(perFrameFactor: number, dt: number): number {
  return Math.pow(perFrameFactor, dt * 60);
}

export function stepCarPhysics(
  state: CarState,
  input: CarInput,
  config: CarPhysicsConfig,
  dt: number,
  surfaceGrip: SurfaceGrip = 1,
  surfaceDrag: SurfaceDrag = 1,
): CarState {
  const oldForward = { x: Math.cos(state.angle), y: Math.sin(state.angle) };
  const oldRight = { x: -oldForward.y, y: oldForward.x };

  const forwardSpeedBefore = state.vx * oldForward.x + state.vy * oldForward.y;
  const lateralSpeedBefore = state.vx * oldRight.x + state.vy * oldRight.y;
  const totalSpeedBefore = Math.hypot(state.vx, state.vy);
  const speedFactor = clamp(totalSpeedBefore / config.maxSpeed, 0, 1);
  const priorSlipRatio = totalSpeedBefore > 1 ? clamp(Math.abs(lateralSpeedBefore) / totalSpeedBefore, 0, 1) : 0;

  // Girar: el volante marca una velocidad angular OBJETIVO proporcional a
  // la velocidad TOTAL (parado no gira), no solo a la componente hacia
  // delante — así, aunque el coche esté derrapando de lado, mantiene
  // autoridad para poder corregir el derrape. El sentido (adelante/marcha
  // atrás) depende de hacia dónde se avanza.
  const turnDirection = Math.sign(forwardSpeedBefore) || 1;
  const targetYawRate = input.steer * config.turnRate * speedFactor * turnDirection;

  // La velocidad angular REAL no salta al objetivo de golpe: tiene
  // inercia, más cuanto más esté patinando ya el coche (priorSlipRatio).
  // Con buen agarre el volante responde casi al instante (conducción
  // normal); patinando fuerte, cuesta más redirigir el morro — por eso el
  // contravolante se nota como "coger" el coche en marcha en vez de un
  // interruptor. No distingue entrar/salir del derrape: la misma fórmula
  // vale para iniciar como para corregir, sin casos especiales.
  const yawCatchUp = clamp(
    YAW_CATCH_UP_RATE * (1 - priorSlipRatio * YAW_INERTIA_FROM_SLIP),
    MIN_YAW_CATCH_UP_RATE,
    1,
  );
  const yawRetention = frameRateIndependentDecay(1 - yawCatchUp, dt);
  const previousYawRate = state.yawRate ?? targetYawRate;
  const yawRate = targetYawRate + (previousYawRate - targetYawRate) * yawRetention;

  const angle = state.angle + yawRate * dt;

  // Motor / freno / marcha atrás a lo largo del morro del coche (dirección
  // al inicio del frame). Pisar "atrás" hace dos cosas distintas según cómo
  // se mueva el coche: si va hacia delante es FRENAR (brakingPower, fuerte);
  // si está parado o ya retrocede es MARCHA ATRÁS (más floja que acelerar).
  const throttle = clamp(input.throttle, -1, 1);
  let power: number;
  if (throttle >= 0) {
    power = config.enginePower;
  } else if (forwardSpeedBefore > 0) {
    power = config.brakingPower;
  } else {
    power = config.enginePower * REVERSE_POWER_FACTOR;
  }
  const acceleration = (throttle * power) / config.mass;

  let vx = state.vx + oldForward.x * acceleration * dt;
  let vy = state.vy + oldForward.y * acceleration * dt;

  // Descomponer la velocidad respecto al NUEVO rumbo del coche: si el morro
  // ha girado más deprisa que la velocidad, aparece una componente lateral
  // (el coche "no sigue" a donde apunta) — ahí nace el derrape.
  const forward = { x: Math.cos(angle), y: Math.sin(angle) };
  const right = { x: -forward.y, y: forward.x };
  const forwardSpeed = vx * forward.x + vy * forward.y;
  const lateralSpeed = vx * right.x + vy * right.y;

  // Convención de "grip" (docs/ANALISIS.md §3.4): mayor agarre = menos
  // derrape. Se traduce a una retención (1 - agarre efectivo): con mucho
  // agarre, casi toda la velocidad lateral se cancela cada frame; con poco
  // agarre (hierba, freno de mano, o girar fuerte a velocidad), se
  // conserva y el coche desliza.
  const corneringSpeedFactor = Math.sqrt(clamp(speedFactor / CORNERING_SPEED_SATURATION, 0, 1));
  const corneringIntensity = Math.abs(input.steer) * corneringSpeedFactor;
  const corneringGripLoss = corneringIntensity * CORNERING_GRIP_LOSS;
  const baseLateralGrip = (input.handbrake ? config.handbrakeGrip : config.gripLateral) * surfaceGrip;
  const effectiveLateralGrip = clamp(baseLateralGrip - corneringGripLoss, MIN_LATERAL_GRIP, 1);
  const forwardDecay = frameRateIndependentDecay(config.gripForward / surfaceDrag, dt);
  const lateralDecay = frameRateIndependentDecay(1 - effectiveLateralGrip, dt);

  const newForwardSpeed = forwardSpeed * forwardDecay;
  const newLateralSpeed = lateralSpeed * lateralDecay;

  vx = forward.x * newForwardSpeed + right.x * newLateralSpeed;
  vy = forward.y * newForwardSpeed + right.y * newLateralSpeed;

  // Limitar a la velocidad máxima del coche.
  const speed = Math.hypot(vx, vy);
  if (speed > config.maxSpeed) {
    const scale = config.maxSpeed / speed;
    vx *= scale;
    vy *= scale;
  }

  return {
    x: state.x + vx * dt,
    y: state.y + vy * dt,
    angle,
    vx,
    vy,
    yawRate,
  };
}

/**
 * Indica si el coche está derrapando (componente lateral de la velocidad
 * significativa respecto a la velocidad total). Útil para disparar
 * partículas/sonido de derrape sin duplicar la lógica de descomposición.
 */
export function isSkidding(state: CarState, thresholdRatio = 0.35): boolean {
  const forward = { x: Math.cos(state.angle), y: Math.sin(state.angle) };
  const right = { x: -forward.y, y: forward.x };
  const lateralSpeed = Math.abs(state.vx * right.x + state.vy * right.y);
  const speed = Math.hypot(state.vx, state.vy);
  if (speed < 1e-3) return false;
  return lateralSpeed / speed > thresholdRatio;
}
