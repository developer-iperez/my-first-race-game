import type { CarPhysicsConfig } from '../config/schema/car';

/**
 * Modelo de físicas arcade (no realista) descrito en docs/ANALISIS.md §3.4,
 * ampliado en v0.4 con "Arcade-Drift Dynamics": física asistida, no
 * simulación de neumáticos — el objetivo es que el jugador pueda "surfear"
 * la carretera y sostener un derrape con el acelerador, no que las fuerzas
 * sean realistas.
 *
 * La idea clave del derrape: la velocidad se descompone en una componente
 * hacia delante (agarre alto = "sobre raíles") y una componente lateral
 * (agarre bajo = desliza). Bajar el agarre lateral -especialmente con el
 * freno de mano- es lo que provoca el derrape.
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
   * "Memoria" de derrape (0 = agarre normal .. 1 = derrape a fondo),
   * suavizada frame a frame en vez de recalculada de golpe cada vez:
   * sube rápido al pedir un derrape (input-driven, respuesta instantánea)
   * pero baja despacio al soltar volante/gas (assisted-correction, evita
   * el "efecto látigo" al recuperar agarre). Opcional: si no se pasa, se
   * asume 0 (coche recién creado, sin derrape en marcha).
   */
  driftIntensity?: number;
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

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Normaliza un ángulo en radianes al rango (-π, π]. */
const normalizeAngle = (radians: number): number => Math.atan2(Math.sin(radians), Math.cos(radians));

/**
 * Cuánto agarre lateral como máximo se resta al girar fuerte a alta
 * velocidad. Con el volante a fondo y a velocidad máxima se llega a perder
 * esta fracción de agarre; girando suave o a baja velocidad casi no
 * afecta, así que las maniobras lentas y precisas (aparcar, esquivar) no
 * se ven penalizadas.
 */
const CORNERING_GRIP_LOSS = 0.95;
/** Agarre lateral mínimo garantizado, para que nunca se vuelva un patinazo sin control. */
const MIN_LATERAL_GRIP = 0.02;

/**
 * "Drift_Threshold": a partir de qué proporción de deslizamiento lateral
 * (lateral/total) se considera que el coche está oficialmente "en
 * derrape" y se activan las asistencias (sostenido con el gas, impulso de
 * giro extra). Coincide con el umbral por defecto de isSkidding, para que
 * partículas/sonido/asistencias se enciendan a la vez.
 */
const DRIFT_THRESHOLD = 0.35;

/**
 * "Grip_Recovery_Rate": retención por frame (a 60fps) de la memoria de
 * derrape mientras BAJA (soltando volante/gas). Alta = recuperación lenta
 * y progresiva ("efecto látigo" evitado); si fuera 0 el agarre volvería
 * de golpe en cuanto se suelta el volante.
 */
const GRIP_RECOVERY_RATE = 0.85;
/**
 * Retención por frame mientras la memoria de derrape SUBE (pidiendo un
 * derrape nuevo). Deliberadamente más baja que GRIP_RECOVERY_RATE: la
 * entrada al derrape debe sentirse instantánea (input-driven), solo la
 * salida es progresiva.
 */
const DRIFT_ENTRY_RATE = 0.5;

/**
 * "Accelerator_Slip_K": una vez dentro de un derrape (driftIntensity por
 * encima de DRIFT_THRESHOLD), cuánto agarre lateral extra se resta por
 * mantener el acelerador pisado — permite sostener el derrape "a gas"
 * (power-slide) en vez de que se apague solo; soltar el acelerador
 * recupera agarre antes.
 */
const ACCELERATOR_SLIP_K = 0.5;

/**
 * "Rotation_Multiplier" (torque vectoring, adaptado a un modelo sin
 * ruedas): impulso de giro extra (rad/s) durante un derrape, modulado por
 * el acelerador y en la misma dirección en la que ya se está girando —
 * así el jugador puede "abrir" el ángulo de derrape acelerando, sin que
 * el asistente gire el coche por su cuenta ni contradiga al volante.
 */
const ROTATION_MULTIPLIER = 6.0;

/**
 * Ángulo máximo entre el morro y la velocidad real (slip angle) que el
 * sistema deja alcanzar "cavando" más hacia el mismo lado del derrape.
 * Sin este límite, mantener el volante a fondo (y sobre todo con el nuevo
 * impulso de torque vectoring) hace que el morro siga girando sin parar
 * hasta dar trompos completos en vez de mantener un ángulo de deriva
 * estable — justo lo que la especificación pide evitar. Contravolantear
 * (girar hacia el lado contrario a la deriva) nunca se ve limitado por
 * esto: la corrección/salida del derrape siempre tiene autoridad completa.
 */
const MAX_SLIP_ANGLE = Math.PI * 0.55; // ~99°

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
): CarState {
  const oldForward = { x: Math.cos(state.angle), y: Math.sin(state.angle) };

  const forwardSpeedBefore = state.vx * oldForward.x + state.vy * oldForward.y;
  const totalSpeedBefore = Math.hypot(state.vx, state.vy);
  const speedFactor = clamp(totalSpeedBefore / config.maxSpeed, 0, 1);

  // Memoria de derrape (ver CarState.driftIntensity): se acerca cada frame
  // a lo que el input está pidiendo ahora mismo (girar fuerte y/o freno de
  // mano, ambos a velocidad), pero a distinta velocidad según suba o baje
  // — instantánea al entrar, progresiva al salir.
  const corneringIntensity = Math.abs(input.steer) * speedFactor;
  const rawDriftDemand = clamp(Math.max(corneringIntensity, input.handbrake ? speedFactor : 0), 0, 1);
  const previousDrift = state.driftIntensity ?? 0;
  const driftEasing = frameRateIndependentDecay(
    rawDriftDemand > previousDrift ? DRIFT_ENTRY_RATE : GRIP_RECOVERY_RATE,
    dt,
  );
  const driftIntensity = rawDriftDemand + (previousDrift - rawDriftDemand) * driftEasing;
  const inDrift = driftIntensity > DRIFT_THRESHOLD;

  // Girar: proporcional a la velocidad TOTAL (parado no gira), no solo a la
  // componente hacia delante — así, aunque el coche esté derrapando de
  // lado, se mantiene autoridad de giro para poder corregir el derrape en
  // vez de perder el control. El sentido (adelante/marcha atrás) sí
  // depende de hacia dónde se avanza.
  const turnDirection = Math.sign(forwardSpeedBefore) || 1;

  // Techo de ángulo de deriva (slip angle): cuánto se ha separado ya el
  // morro de hacia dónde va realmente el coche. Seguir girando hacia ESE
  // mismo lado pierde autoridad a medida que se acerca al techo (así el
  // derrape se estabiliza en vez de convertirse en un trompo continuo);
  // girar hacia el lado contrario (contravolantear, salir del derrape)
  // siempre conserva autoridad completa.
  const velocityAngle = totalSpeedBefore > 1 ? Math.atan2(state.vy, state.vx) : state.angle;
  const slipAngle = normalizeAngle(state.angle - velocityAngle);
  const steerContribSign = Math.sign(input.steer * turnDirection);
  const wideningSlip = steerContribSign !== 0 && Math.sign(slipAngle) === steerContribSign;
  const rotationAuthority = wideningSlip ? clamp(1 - Math.abs(slipAngle) / MAX_SLIP_ANGLE, 0, 1) : 1;

  let angle = state.angle + input.steer * config.turnRate * speedFactor * turnDirection * rotationAuthority * dt;

  // Torque vectoring (adaptado): dentro de un derrape, mantener el
  // acelerador pisado da un impulso de giro extra en la misma dirección en
  // la que ya se está girando — así se puede "abrir" el ángulo de derrape
  // con el gas sin que el asistente tome el volante por el jugador. Sujeto
  // al mismo techo, para que no reintroduzca el trompo continuo.
  if (inDrift && input.steer !== 0) {
    const rotationBoost =
      ROTATION_MULTIPLIER * clamp(input.throttle, 0, 1) * driftIntensity * Math.sign(input.steer) * rotationAuthority;
    angle += rotationBoost * dt;
  }

  // Motor / freno a lo largo del morro del coche (dirección al inicio del frame).
  const throttle = clamp(input.throttle, -1, 1);
  const power = throttle >= 0 ? config.enginePower : config.brakingPower;
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
  // agarre (hierba, freno de mano), se conserva y el coche desliza.
  //
  // La pérdida de agarre por curva usa driftIntensity (suavizada) en vez
  // del input instantáneo, y una vez dentro del derrape el acelerador
  // resta agarre extra (Slip Ratio del spec) — sostener el gas mantiene el
  // derrape "vivo"; soltarlo lo apaga antes.
  const corneringGripLoss = driftIntensity * CORNERING_GRIP_LOSS;
  const throttleSlip = inDrift ? clamp(input.throttle, 0, 1) * ACCELERATOR_SLIP_K * driftIntensity : 0;
  const baseLateralGrip = (input.handbrake ? config.handbrakeGrip : config.gripLateral) * surfaceGrip;
  const effectiveLateralGrip = clamp(baseLateralGrip - corneringGripLoss - throttleSlip, MIN_LATERAL_GRIP, 1);
  const forwardDecay = frameRateIndependentDecay(config.gripForward, dt);
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
    driftIntensity,
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
