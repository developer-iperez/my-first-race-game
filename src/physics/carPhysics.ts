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
   * DEFAULT_YAW_CATCH_UP_RATE). Opcional: si no se pasa, se asume igual al
   * objetivo instantáneo (coche recién creado, sin inercia de giro previa
   * que arrastrar).
   */
  yawRate?: number;
  /**
   * Agarre lateral efectivo del frame anterior (0..1). Se suaviza para que
   * soltar el freno de mano no devuelva el agarre de golpe: las ruedas
   * tardan unos frames en volver a morder. Opcional: si no se pasa, se usa
   * el objetivo de este frame (primer frame del coche).
   */
  lateralGrip?: number;
  /**
   * Tiempo acumulado manteniendo "atrás" con el coche parado. Evita que
   * frenar hasta cero encadene marcha atrás sin querer: hay que sostener
   * 0,18 s para que el coche empiece a retroceder.
   */
  reverseHold?: number;
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
 * Resistencia al avance de la superficie bajo el coche (asfalto=1,
 * hierba>1...). A diferencia de SurfaceGrip (que solo afecta al agarre
 * lateral, es decir cuánto derrapa), esto frena la velocidad hacia delante:
 * sin esto, salirse de la pista solo hacía que el coche patinara más de
 * lado, pero seguía corriendo prácticamente igual de rápido hacia donde
 * apuntaba.
 *
 * Cada punto por encima de 1 añade `SURFACE_DRAG_ACCEL` px/s² de
 * deceleración, de forma aditiva: así 1.06 en hierba frena un poco y 1.2 en
 * arena frena más, sin depender de la retención interna del motor.
 */
export type SurfaceDrag = number;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Defaults de handling. Los valores tuneados del coche pueden vivir en su
 * JSON (`public/cars/*.json`); si un campo no aparece, se usa el default de
 * aquí. Así los datos antiguos siguen funcionando y el tuning fino no exige
 * tocar código.
 *
 * Cuánto agarre lateral como máximo se resta al girar fuerte a alta
 * velocidad (más derrape en curvas cerradas tomadas rápido).
 */
const DEFAULT_CORNERING_GRIP_LOSS = 0.9;
/**
 * Fracción de maxSpeed a partir de la cual girar fuerte pierde el máximo de
 * agarre lateral posible (ver DEFAULT_CORNERING_GRIP_LOSS). Por debajo
 * satura antes de llegar a velocidad punta: así el derrape no depende de ir
 * pegado al tope de velocidad.
 */
const DEFAULT_CORNERING_SPEED_SATURATION = 0.7;
/**
 * Agarre lateral mínimo garantizado SOLO por girar fuerte (sin freno de
 * mano). Se deja más alto que el mínimo con freno de mano a propósito: si
 * girar fuerte por sí solo ya saturase hasta el mismo suelo que el freno de
 * mano, pisar el freno de mano a mitad de curva no cambiaría nada.
 */
const DEFAULT_MIN_LATERAL_GRIP_STEER = 0.05;
/** Agarre lateral mínimo con freno de mano: más bajo, para un derrape más profundo siempre disponible. */
const DEFAULT_MIN_LATERAL_GRIP_HANDBRAKE = 0.015;

/**
 * Boost temporal de pérdida de agarre lateral al invertir el sentido de la
 * rotación (yawRate) — el "contravolante rápido" (Scandinavian flick). Se
 * desvanece solo en un par de frames porque previousYawRate decae por su
 * propia inercia.
 */
const DEFAULT_FLICK_GRIP_LOSS_BOOST = 0.85;
/**
 * Fracción de la velocidad total que se inyecta como velocidad lateral al
 * detectar un flick: el "empujón" real que sostiene el derrape. Se mantiene
 * bajo para que no se sienta como un latigazo artificial.
 */
const DEFAULT_FLICK_LATERAL_KICK = 0.3;
/**
 * Ratio de derrape previo por debajo del cual un cambio de sentido de
 * yawRate se considera un flick nuevo, no la recuperación de un derrape.
 */
const DEFAULT_FLICK_MAX_PRIOR_SLIP = 0.3;

/**
 * Retención de velocidad hacia delante por frame a 60fps con el freno de
 * mano puesto. 0.90 perdía la mitad de la velocidad en ~6 frames; con 0.97
 * el freno de mano derrapa sin convertirse en un ancla instantánea.
 */
const DEFAULT_HANDBRAKE_FORWARD_RETENTION = 0.97;

/**
 * Fracción del hueco entre la velocidad angular actual y la que pide el
 * volante que se cierra cada frame a 60fps CUANDO EL COCHE TIENE BUEN
 * AGARRE. No es un techo ni un bloqueo: es cuánto "pesa" girar el morro.
 */
const DEFAULT_YAW_CATCH_UP_RATE = 0.65;
/**
 * Cuánto reduce el agarre lateral bajo (coche ya patinando) esa misma
 * capacidad de cambiar de velocidad angular: a más derrape, más cuesta
 * redirigir el morro. Se aplica igual entrando o saliendo del derrape.
 */
const DEFAULT_YAW_INERTIA_FROM_SLIP = 0.85;
/** Capacidad mínima de cambiar de velocidad angular incluso a patinazo completo. */
const DEFAULT_MIN_YAW_CATCH_UP_RATE = 0.12;

/**
 * Fracción de la potencia del motor (enginePower) que se usa al ir marcha
 * atrás, para que dé menos aceleración que hacia delante. NO afecta al
 * frenado: pisar "atrás" yendo hacia delante sigue usando brakingPower.
 */
const DEFAULT_REVERSE_POWER_FACTOR = 0.4;
/** Tiempo que hay que sostener "atrás" desde parado antes de engranar la marcha atrás. */
const REVERSE_DELAY_SECONDS = 0.18;

/**
 * Subviraje: factor que reduce el giro a alta velocidad. Con 0 el radio es
 * constante (como el modelo antiguo); con valores altos el coche abre la
 * trazada al acelerar, que es lo que da sensación de peso.
 */
const DEFAULT_UNDERSTEER = 0;

/**
 * Suavizado del agarre lateral. Al girar o frenar, el agarre cae rápido
 * (dropRate alto) para que el coche reaccione; al soltar el freno de mano,
 * vuelve lento (riseRate bajo) para que la recuperación no sea un
 * interruptor. Ambos son "fracción del hueco por frame a 60 fps" y se
 * corrigen por dt.
 */
const DEFAULT_GRIP_DROP_RATE = 0.5;
const DEFAULT_GRIP_RISE_RATE = 0.05;

/**
 * Cuánta deceleración extra (px/s²) añade una superficie por cada punto de
 * `drag` por encima de 1. Con el modelo de retención por frame antiguo,
 * dividir por `drag` hacía que hierba (1.06) pasase de perder un 2% a un 6%
 * por frame: con el coche nuevo, eso lo dejaba casi parado. Aquí la
 * resistencia es aditiva y escala igual a cualquier velocidad base.
 */
const SURFACE_DRAG_ACCEL = 1300;

/**
 * Aplica un factor de "agarre/fricción por frame a 60fps" de forma
 * independiente del framerate real, usando dt en segundos. Se exporta para
 * que otros efectos de fricción (p.ej. frenado fuerte al salirse de pista
 * en RaceScene) usen la misma matemática en vez de reinventarla.
 */
export function frameRateIndependentDecay(perFrameFactor: number, dt: number): number {
  return Math.pow(perFrameFactor, dt * 60);
}

/**
 * Diagnóstico de un paso de física: los valores intermedios que explican
 * POR QUÉ el coche se comporta como lo hace ese frame (cuánto agarre le
 * queda, si se ha detectado un flick, etc.), pensado para un HUD de
 * telemetría en pantalla — en móvil no hay devtools para poner
 * console.log y leerlo en directo mientras se juega.
 */
export interface DriveTelemetry {
  /** Velocidad total (px/s) al INICIO del frame, antes de aplicar este paso. */
  speed: number;
  /** speed / maxSpeed, recortado a [0,1]. */
  speedFactor: number;
  /** Cuánto se pierde de agarre lateral este frame por girar fuerte y/o flick (0 = nada, 1 = el máximo posible). */
  corneringGripLoss: number;
  /** Agarre lateral que queda tras restar corneringGripLoss (mayor = menos derrape). */
  effectiveLateralGrip: number;
  /** Si este frame se ha detectado un flick (contravolante rápido antes de girar hacia la curva). */
  isFlick: boolean;
  /** Fuerza del flick detectado (0..1), o 0 si no hay flick. */
  flickStrength: number;
  /** Freno de mano pulsado este frame (passthrough del input, para no tener que guardarlo aparte). */
  handbrake: boolean;
  /** Ratio de derrape (velocidad lateral / velocidad total) del estado RESULTANTE tras este paso. */
  slipRatio: number;
  /** Superficie dominante bajo las ruedas; la rellena Car, que es quien muestrea. */
  surfaceKey?: string;
}

interface StepResult {
  nextState: CarState;
  telemetry: DriveTelemetry;
}

function computeStep(
  state: CarState,
  input: CarInput,
  config: CarPhysicsConfig,
  dt: number,
  surfaceGrip: SurfaceGrip,
  surfaceDrag: SurfaceDrag,
): StepResult {
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
  //
  // El subviraje reduce el giro a alta velocidad: el coche no puede cerrar
  // la misma curva a 300 px/s que a 80. Con understeer=0 se recupera el
  // comportamiento "radio constante" del modelo antiguo.
  const turnDirection = Math.sign(forwardSpeedBefore) || 1;
  const understeer = config.understeer ?? DEFAULT_UNDERSTEER;
  const understeerScale = 1 + understeer * speedFactor * speedFactor;
  const targetYawRate =
    (input.steer * config.turnRate * speedFactor * turnDirection) / understeerScale;

  // La velocidad angular REAL no salta al objetivo de golpe: tiene
  // inercia, más cuanto más esté patinando ya el coche (priorSlipRatio).
  // Con buen agarre el volante responde casi al instante (conducción
  // normal); patinando fuerte, cuesta más redirigir el morro — por eso el
  // contravolante se nota como "coger" el coche en marcha en vez de un
  // interruptor. No distingue entrar/salir del derrape: la misma fórmula
  // vale para iniciar como para corregir, sin casos especiales.
  const yawCatchUp = clamp(
    (config.yawCatchUpRate ?? DEFAULT_YAW_CATCH_UP_RATE) *
      (1 - priorSlipRatio * (config.yawInertiaFromSlip ?? DEFAULT_YAW_INERTIA_FROM_SLIP)),
    config.minYawCatchUpRate ?? DEFAULT_MIN_YAW_CATCH_UP_RATE,
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
  const reversePower = config.enginePower * (config.reversePowerFactor ?? DEFAULT_REVERSE_POWER_FACTOR);
  let power: number;
  let reverseHold = 0;
  if (throttle >= 0) {
    power = config.enginePower;
  } else if (forwardSpeedBefore > 0) {
    power = config.brakingPower;
  } else if (forwardSpeedBefore < -1) {
    // Ya está retrocediendo: no hace falta volver a esperar el delay.
    power = reversePower;
  } else {
    reverseHold = (state.reverseHold ?? 0) + dt;
    power = reverseHold >= REVERSE_DELAY_SECONDS ? reversePower : 0;
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
  let lateralSpeed = vx * right.x + vy * right.y;

  // El "contravolante rápido" (Scandinavian flick: golpe de volante al lado
  // contrario y enseguida al de la curva) no solo debe aflojar el agarre un
  // instante — necesita un empujón de velocidad lateral REAL para que el
  // derrape se sostenga después, en vez de un simple parpadeo que se
  // cancela solo en 2-3 frames al re-proyectar sobre el nuevo rumbo (que
  // gira rapidísimo durante la propia inversión). El impulso sale en
  // sentido CONTRARIO al nuevo giro (la trasera se va para el lado opuesto
  // de hacia donde ahora apunta el morro) y es proporcional a lo fuerte que
  // llevaba la rotación previa que hay que revertir.
  //
  // La misma inversión de signo (previousYawRate vs targetYawRate) ocurre
  // también al RECUPERAR un derrape ya en marcha con contravolante (el
  // mecanismo de inercia de yaw ya cubre ese caso, ver DEFAULT_YAW_INERTIA_FROM_SLIP)
  // — por eso el flick solo se activa si el coche NO estaba ya derrapando
  // fuerte (priorSlipRatio bajo): así se distingue "provocar un derrape
  // nuevo con un golpe de volante" de "corregir uno que ya existe", que son
  // el mismo cambio de signo pero deben sentirse distinto.
  const isFlick =
    Math.sign(previousYawRate) * Math.sign(targetYawRate) < 0 &&
    priorSlipRatio < (config.flickMaxPriorSlip ?? DEFAULT_FLICK_MAX_PRIOR_SLIP);
  const flickStrength = isFlick ? clamp(Math.abs(previousYawRate) / config.turnRate, 0, 1) : 0;
  if (flickStrength > 0) {
    const flickImpulse = config.flickImpulse ?? DEFAULT_FLICK_LATERAL_KICK;
    lateralSpeed += -Math.sign(targetYawRate) * flickStrength * flickImpulse * totalSpeedBefore;
  }

  // Convención de "grip" (docs/ANALISIS.md §3.4): mayor agarre = menos
  // derrape. Se traduce a una retención (1 - agarre efectivo): con mucho
  // agarre, casi toda la velocidad lateral se cancela cada frame; con poco
  // agarre (hierba, freno de mano, o girar fuerte a velocidad), se
  // conserva y el coche desliza.
  const corneringSpeedSaturation =
    config.corneringSpeedSaturation ?? DEFAULT_CORNERING_SPEED_SATURATION;
  const corneringSpeedFactor = Math.sqrt(clamp(speedFactor / corneringSpeedSaturation, 0, 1));
  const corneringIntensity = Math.abs(input.steer) * corneringSpeedFactor;
  const flickGripLoss =
    flickStrength * (config.flickGripLossBoost ?? DEFAULT_FLICK_GRIP_LOSS_BOOST);
  const corneringGripLoss = clamp(
    corneringIntensity * (config.corneringGripLoss ?? DEFAULT_CORNERING_GRIP_LOSS) + flickGripLoss,
    0,
    1,
  );
  const baseLateralGrip = (input.handbrake ? config.handbrakeGrip : config.gripLateral) * surfaceGrip;
  const minLateralGrip =
    (input.handbrake
      ? (config.handbrakeMinGrip ?? DEFAULT_MIN_LATERAL_GRIP_HANDBRAKE)
      : (config.minLateralGrip ?? DEFAULT_MIN_LATERAL_GRIP_STEER)) * surfaceGrip;
  const targetLateralGrip = clamp(baseLateralGrip - corneringGripLoss, minLateralGrip, 1);

  // El agarre no salta de 0.05 a 0.9 en un frame al soltar el freno de
  // mano: cae rápido cuando se pierde, pero vuelve lento cuando la rueda
  // intenta morder otra vez. Con riseRate=0.05 tarda ~0,3 s en recuperar la
  // mitad del agarre; es la diferencia entre "el coche agarra" y "el coche
  // da un tirón".
  const previousLateralGrip = state.lateralGrip ?? targetLateralGrip;
  const gripRate =
    targetLateralGrip < previousLateralGrip
      ? (config.gripDropRate ?? DEFAULT_GRIP_DROP_RATE)
      : (config.gripRiseRate ?? DEFAULT_GRIP_RISE_RATE);
  const gripRetention = frameRateIndependentDecay(1 - gripRate, dt);
  const effectiveLateralGrip =
    targetLateralGrip + (previousLateralGrip - targetLateralGrip) * gripRetention;

  // El freno de mano bloquea las ruedas traseras: además de soltar el
  // agarre lateral (arriba), eso también frena de verdad — sin esto, pisar
  // el freno de mano en línea recta (sin volante) no hacía absolutamente
  // nada distinto de simplemente soltar el acelerador.
  const handbrakeForwardDecay = input.handbrake
    ? frameRateIndependentDecay(
        config.handbrakeForwardRetention ?? DEFAULT_HANDBRAKE_FORWARD_RETENTION,
        dt,
      )
    : 1;
  const baseForwardRetention = frameRateIndependentDecay(config.gripForward, dt);
  // La resistencia de superficie nunca puede superar el 60% del empuje del
  // motor: si no, una arena con drag alto dejaría el coche clavado al
  // acelerar desde parado. Sigue habiendo diferencia entre superficies, pero
  // cualquier superficie es transitable.
  const engineAccel = config.enginePower / config.mass;
  const surfaceDragAccel = Math.min(
    engineAccel * 0.6,
    Math.max(0, surfaceDrag - 1) * SURFACE_DRAG_ACCEL,
  );
  const dragDrop = surfaceDragAccel * dt;
  const forwardAfterDrag =
    forwardSpeed > 0
      ? Math.max(0, forwardSpeed - dragDrop)
      : forwardSpeed < 0
        ? Math.min(0, forwardSpeed + dragDrop)
        : 0;
  const forwardDecay = baseForwardRetention * handbrakeForwardDecay;
  const lateralDecay = frameRateIndependentDecay(1 - effectiveLateralGrip, dt);

  const newForwardSpeed = forwardAfterDrag * forwardDecay;
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

  const nextState: CarState = {
    x: state.x + vx * dt,
    y: state.y + vy * dt,
    angle,
    vx,
    vy,
    yawRate,
    lateralGrip: effectiveLateralGrip,
    reverseHold,
  };

  return {
    nextState,
    telemetry: {
      speed: totalSpeedBefore,
      speedFactor,
      corneringGripLoss,
      effectiveLateralGrip,
      isFlick,
      flickStrength,
      handbrake: input.handbrake,
      slipRatio: computeSlipRatio(nextState),
    },
  };
}

export function stepCarPhysics(
  state: CarState,
  input: CarInput,
  config: CarPhysicsConfig,
  dt: number,
  surfaceGrip: SurfaceGrip = 1,
  surfaceDrag: SurfaceDrag = 1,
): CarState {
  return computeStep(state, input, config, dt, surfaceGrip, surfaceDrag).nextState;
}

/** Igual que stepCarPhysics, pero además devuelve el diagnóstico del frame (ver DriveTelemetry) para un HUD de depuración. */
export function stepCarPhysicsWithTelemetry(
  state: CarState,
  input: CarInput,
  config: CarPhysicsConfig,
  dt: number,
  surfaceGrip: SurfaceGrip = 1,
  surfaceDrag: SurfaceDrag = 1,
): StepResult {
  return computeStep(state, input, config, dt, surfaceGrip, surfaceDrag);
}

/** Ratio de derrape (velocidad lateral / velocidad total) de un estado. 0 si está parado. */
function computeSlipRatio(state: CarState): number {
  const forward = { x: Math.cos(state.angle), y: Math.sin(state.angle) };
  const right = { x: -forward.y, y: forward.x };
  const lateralSpeed = Math.abs(state.vx * right.x + state.vy * right.y);
  const speed = Math.hypot(state.vx, state.vy);
  if (speed < 1e-3) return 0;
  return lateralSpeed / speed;
}

/**
 * Indica si el coche está derrapando (componente lateral de la velocidad
 * significativa respecto a la velocidad total). Útil para disparar
 * partículas/sonido de derrape sin duplicar la lógica de descomposición.
 */
export function isSkidding(state: CarState, thresholdRatio = 0.35): boolean {
  return computeSlipRatio(state) > thresholdRatio;
}
