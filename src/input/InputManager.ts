import type { CarInput } from '../physics/carPhysics';

/**
 * Estado digital común a teclado y táctil. Los controles táctiles ya
 * exponen esta forma; el teclado se adapta a ella en RaceScene.
 */
export interface DigitalInputState {
  throttleUp: boolean;
  throttleDown: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

export interface GamepadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

export interface InputSources {
  keyboard: DigitalInputState;
  touch: DigitalInputState;
  gamepad?: GamepadLike | null;
}

const DEADZONE = 0.15;
/** Tiempo en pasar de volante centrado a volante a fondo. */
const STEER_RAMP_SECONDS = 0.15;
/** Al soltar, el volante vuelve algo más rápido para no dejar el coche girado. */
const STEER_RETURN_SECONDS = 0.1;

const STEER_RATE = 1 / STEER_RAMP_SECONDS;
const STEER_RETURN_RATE = 1 / STEER_RETURN_SECONDS;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return current;
}

function applyDeadzone(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= DEADZONE) return 0;
  return Math.sign(value) * ((magnitude - DEADZONE) / (1 - DEADZONE));
}

function readGamepad(gamepad: GamepadLike): CarInput {
  const steer = applyDeadzone(gamepad.axes[0] ?? 0);
  let throttle = (gamepad.buttons[7]?.value ?? 0) - (gamepad.buttons[6]?.value ?? 0);

  // Si el mando no tiene gatillos analógicos, se usan A/B como acelerar/frenar.
  if (Math.abs(throttle) < 0.05) {
    if (gamepad.buttons[0]?.pressed) throttle += 1;
    if (gamepad.buttons[1]?.pressed) throttle -= 1;
  }

  return {
    throttle: clamp(throttle, -1, 1),
    steer,
    handbrake: Boolean(gamepad.buttons[5]?.pressed || gamepad.buttons[2]?.pressed),
  };
}

/**
 * Mezcla teclado, táctil y gamepad en un único `CarInput` y suaviza el
 * volante. Sin esta rampa, pulsar izquierda/derecha pasa de 0 a 1 en un
 * frame y el coche se siente como un interruptor; con ella, el volante
 * tarda ~0,15 s en llegar a fondo y ~0,10 s en volver.
 */
export class InputManager {
  private smoothedSteer = 0;

  update(dtSeconds: number, sources: InputSources): CarInput {
    const keyboard = sources.keyboard;
    const touch = sources.touch;

    let throttleTarget =
      (keyboard.throttleUp || touch.throttleUp ? 1 : 0) -
      (keyboard.throttleDown || touch.throttleDown ? 1 : 0);
    let steerTarget =
      (keyboard.right || touch.right ? 1 : 0) - (keyboard.left || touch.left ? 1 : 0);
    let handbrake = keyboard.handbrake || touch.handbrake;

    if (sources.gamepad) {
      const gamepad = readGamepad(sources.gamepad);
      if (Math.abs(gamepad.steer) > 0) steerTarget = gamepad.steer;
      if (Math.abs(gamepad.throttle) > 0) throttleTarget = gamepad.throttle;
      handbrake = handbrake || gamepad.handbrake;
    }

    const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
    const steerRate = steerTarget === 0 ? STEER_RETURN_RATE : STEER_RATE;
    this.smoothedSteer = moveTowards(
      this.smoothedSteer,
      clamp(steerTarget, -1, 1),
      steerRate * dt,
    );

    return {
      throttle: clamp(throttleTarget, -1, 1),
      steer: this.smoothedSteer,
      handbrake,
    };
  }

  /** Descarta la rampa actual (reinicio de escena, pausa larga). */
  reset(): void {
    this.smoothedSteer = 0;
  }
}
