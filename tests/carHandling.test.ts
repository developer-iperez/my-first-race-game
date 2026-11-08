import { describe, expect, it } from 'vitest';
import carFixture from '../public/cars/rally-hatch.json';
import { parseCar } from '../src/config/schema/car';
import { applyTuningToPhysics, DEFAULT_CAR_TUNING } from '../src/settings/carTuning';
import { stepCarPhysics, type CarInput, type CarState } from '../src/physics/carPhysics';

const car = parseCar(carFixture);
const physics = applyTuningToPhysics(car.physics, DEFAULT_CAR_TUNING);
const dt = 1 / 60;
const still: CarState = { x: 0, y: 0, angle: 0, vx: 0, vy: 0, yawRate: 0 };

function simulate(initial: CarState, input: CarInput, frames: number, cfg = physics): CarState {
  let state = initial;
  for (let i = 0; i < frames; i++) state = stepCarPhysics(state, input, cfg, dt);
  return state;
}

describe('handling del coche de producción', () => {
  it('el subviraje reduce el giro a alta velocidad', () => {
    const straight: CarState = { ...still, vx: physics.maxSpeed };
    const input: CarInput = { throttle: 1, steer: 1, handbrake: false };
    const withoutUndersteer = simulate(straight, input, 30, { ...physics, understeer: 0 });
    const withUndersteer = simulate(straight, input, 30, { ...physics, understeer: 1.68 });

    expect(Math.abs(withUndersteer.yawRate ?? 0)).toBeLessThan(
      Math.abs(withoutUndersteer.yawRate ?? 0),
    );
  });

  it('el agarre lateral se recupera de forma progresiva al soltar el freno de mano', () => {
    const entry: CarState = { ...still, vx: physics.maxSpeed * 0.8 };
    const drifting = simulate(entry, { throttle: 1, steer: 1, handbrake: false }, 30);
    const handbraked = simulate(drifting, { throttle: 0, steer: 1, handbrake: true }, 30);

    expect(handbraked.lateralGrip).toBeLessThan(0.2);

    const firstFrame = stepCarPhysics(
      handbraked,
      { throttle: 1, steer: 0, handbrake: false },
      physics,
      dt,
    );
    expect(firstFrame.lateralGrip).toBeGreaterThan(handbraked.lateralGrip ?? 0);
    expect(firstFrame.lateralGrip).toBeLessThan(0.5);

    const recovered = simulate(handbraked, { throttle: 1, steer: 0, handbrake: false }, 30);
    expect(recovered.lateralGrip).toBeGreaterThan(0.5);
    expect(recovered.lateralGrip).toBeLessThanOrEqual(physics.gripLateral + 1e-6);
  });

  it('el agarre lateral cae rápido al entrar en curva', () => {
    const straight: CarState = { ...still, vx: physics.maxSpeed };
    const afterFrame = stepCarPhysics(
      straight,
      { throttle: 0, steer: 1, handbrake: true },
      physics,
      dt,
    );

    expect(afterFrame.lateralGrip).toBeDefined();
    expect(afterFrame.lateralGrip ?? 1).toBeLessThan(physics.gripLateral * 0.75);
  });

  it('la resistencia de superficie no deja el coche clavado al acelerar desde parado', () => {
    let state = still;
    for (let i = 0; i < 8 * 60; i++) {
      state = stepCarPhysics(state, { throttle: 1, steer: 0, handbrake: false }, physics, dt, 0.75, 1.12);
    }

    const speed = Math.hypot(state.vx, state.vy);
    expect(speed).toBeGreaterThan(50);
    expect(speed).toBeLessThan(physics.maxSpeed);
  });
});
