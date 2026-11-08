import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_FRAME_DELTA_SECONDS,
  DEFAULT_MAX_SUBSTEPS,
  FixedStepLoop,
} from '../src/physics/fixedStep';
import { stepCarPhysics, type CarState } from '../src/physics/carPhysics';
import type { CarPhysicsConfig } from '../src/config/schema/car';

const physics: CarPhysicsConfig = {
  mass: 1,
  enginePower: 900,
  brakingPower: 1200,
  maxSpeed: 260,
  turnRate: 3.2,
  gripForward: 0.98,
  gripLateral: 0.9,
  handbrakeGrip: 0.6,
  length: 24,
  width: 12,
};

const still: CarState = { x: 0, y: 0, angle: 0, vx: 0, vy: 0, yawRate: 0 };

function runWithFps(fps: number, seconds: number): { steps: number; state: CarState } {
  const loop = new FixedStepLoop({ hz: 120 });
  let steps = 0;
  let state = still;
  const frameSeconds = 1 / fps;
  const totalFrames = Math.round(fps * seconds);

  for (let frame = 0; frame < totalFrames; frame++) {
    loop.advance(frameSeconds, () => {
      steps += 1;
      state = stepCarPhysics(state, { throttle: 1, steer: 0, handbrake: false }, physics, 1 / 120);
    });
  }

  return { steps, state };
}

describe('FixedStepLoop', () => {
  it('ejecuta el mismo número de pasos por segundo a 30, 60 y 144 fps', () => {
    const at30 = runWithFps(30, 2);
    const at60 = runWithFps(60, 2);
    const at144 = runWithFps(144, 2);

    expect(at30.steps).toBe(240);
    expect(at60.steps).toBe(240);
    expect(at144.steps).toBe(240);
    expect(at30.state.x).toBeCloseTo(at60.state.x, 6);
    expect(at144.state.x).toBeCloseTo(at60.state.x, 6);
  });

  it('recorta un frame gigante para no teletransportar el coche', () => {
    const loop = new FixedStepLoop();
    let steps = 0;
    const executed = loop.advance(2, () => {
      steps += 1;
    });

    expect(executed).toBe(DEFAULT_MAX_SUBSTEPS);
    expect(steps).toBe(DEFAULT_MAX_SUBSTEPS);
    expect(loop.pendingSeconds).toBe(0);
  });

  it('acepta exactamente un frame de 250 ms sin descartar tiempo', () => {
    const loop = new FixedStepLoop({ hz: 100, maxSubsteps: 30 });
    let steps = 0;
    loop.advance(DEFAULT_MAX_FRAME_DELTA_SECONDS, () => {
      steps += 1;
    });

    expect(steps).toBe(25);
    expect(loop.pendingSeconds).toBeCloseTo(0, 8);
  });

  it('detiene el bucle cuando el callback devuelve false', () => {
    const loop = new FixedStepLoop();
    let steps = 0;
    const executed = loop.advance(0.1, () => {
      steps += 1;
      return steps < 3;
    });

    expect(executed).toBe(3);
    expect(loop.pendingSeconds).toBe(0);
  });

  it('reset descarta el tiempo pendiente', () => {
    const loop = new FixedStepLoop();
    loop.advance(0.004, () => {});
    expect(loop.pendingSeconds).toBeGreaterThan(0);

    loop.reset();
    expect(loop.pendingSeconds).toBe(0);
  });

  it('ignora deltas inválidos o negativos', () => {
    const loop = new FixedStepLoop();
    let steps = 0;

    expect(loop.advance(0, () => { steps += 1; })).toBe(0);
    expect(loop.advance(-1, () => { steps += 1; })).toBe(0);
    expect(loop.advance(Number.NaN, () => { steps += 1; })).toBe(0);
    expect(steps).toBe(0);
  });

  it('valida su configuración', () => {
    expect(() => new FixedStepLoop({ hz: 0 })).toThrow();
    expect(() => new FixedStepLoop({ maxFrameDeltaSeconds: 0 })).toThrow();
    expect(() => new FixedStepLoop({ maxSubsteps: 0 })).toThrow();
  });
});
