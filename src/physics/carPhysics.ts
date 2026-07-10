import type { CarPhysicsConfig } from '../config/schema/car';

/**
 * Modelo de físicas arcade (no realista) descrito en docs/ANALISIS.md §3.4.
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

/**
 * Aplica un factor de "agarre/fricción por frame a 60fps" de forma
 * independiente del framerate real, usando dt en segundos.
 */
function frameRateIndependentDecay(perFrameFactor: number, dt: number): number {
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

  // Girar: proporcional a la velocidad hacia delante (parado no gira), y en
  // el sentido de la marcha (marcha atrás gira al revés).
  const speedFactor = clamp(Math.abs(forwardSpeedBefore) / config.maxSpeed, 0, 1);
  const turnDirection = Math.sign(forwardSpeedBefore) || 1;
  const angle = state.angle + input.steer * config.turnRate * speedFactor * turnDirection * dt;

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
  const lateralGrip = input.handbrake ? config.handbrakeGrip : config.gripLateral;
  const effectiveLateralGrip = clamp(lateralGrip * surfaceGrip, 0, 1);
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
