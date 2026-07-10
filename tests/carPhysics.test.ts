import { describe, expect, it } from 'vitest';
import { stepCarPhysics, isSkidding, type CarState } from '../src/physics/carPhysics';
import type { CarPhysicsConfig } from '../src/config/schema/car';

const baseConfig: CarPhysicsConfig = {
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

const stillState: CarState = { x: 0, y: 0, angle: 0, vx: 0, vy: 0 };
const noSteerInput = { throttle: 0, steer: 0, handbrake: false };

describe('stepCarPhysics', () => {
  it('accelerates forward when throttle is positive', () => {
    const result = stepCarPhysics(stillState, { ...noSteerInput, throttle: 1 }, baseConfig, 1 / 60);
    expect(result.vx).toBeGreaterThan(0);
    expect(result.x).toBeGreaterThan(0);
  });

  it('does not move with zero throttle from rest', () => {
    const result = stepCarPhysics(stillState, noSteerInput, baseConfig, 1 / 60);
    expect(result.vx).toBeCloseTo(0);
    expect(result.vy).toBeCloseTo(0);
  });

  it('never exceeds maxSpeed even after many accelerating steps', () => {
    let state = stillState;
    for (let i = 0; i < 600; i++) {
      state = stepCarPhysics(state, { ...noSteerInput, throttle: 1 }, baseConfig, 1 / 60);
    }
    const speed = Math.hypot(state.vx, state.vy);
    expect(speed).toBeLessThanOrEqual(baseConfig.maxSpeed + 1e-6);
  });

  it('does not turn while stationary (parado no gira)', () => {
    const result = stepCarPhysics(stillState, { ...noSteerInput, steer: 1 }, baseConfig, 1 / 60);
    expect(result.angle).toBe(stillState.angle);
  });

  it('turns when moving and steering', () => {
    const moving: CarState = { x: 0, y: 0, angle: 0, vx: 100, vy: 0 };
    const result = stepCarPhysics(moving, { ...noSteerInput, steer: 1 }, baseConfig, 1 / 60);
    expect(result.angle).toBeGreaterThan(moving.angle);
  });

  it('is frame-rate independent for straight-line acceleration', () => {
    const bigStep = stepCarPhysics(stillState, { ...noSteerInput, throttle: 1 }, baseConfig, 1);
    let small = stillState;
    for (let i = 0; i < 60; i++) {
      small = stepCarPhysics(small, { ...noSteerInput, throttle: 1 }, baseConfig, 1 / 60);
    }
    expect(small.vx).toBeCloseTo(bigStep.vx, 0);
  });

  it('reducing lateral grip (handbrake) produces more skid than normal grip', () => {
    const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 150, vy: 0 };
    const normal = stepCarPhysics(
      cornering,
      { throttle: 0, steer: 1, handbrake: false },
      baseConfig,
      0.2,
    );
    const handbraking = stepCarPhysics(
      cornering,
      { throttle: 0, steer: 1, handbrake: true },
      baseConfig,
      0.2,
    );
    const lateralOf = (s: CarState) => {
      const fwd = { x: Math.cos(s.angle), y: Math.sin(s.angle) };
      const right = { x: -fwd.y, y: fwd.x };
      return Math.abs(s.vx * right.x + s.vy * right.y);
    };
    expect(lateralOf(handbraking)).toBeGreaterThan(lateralOf(normal));
  });

  it('lower surface grip increases lateral sliding', () => {
    const cornering: CarState = { x: 0, y: 0, angle: 0, vx: 150, vy: 0 };
    const onAsphalt = stepCarPhysics(cornering, { throttle: 0, steer: 1, handbrake: false }, baseConfig, 0.2, 1);
    const onGrass = stepCarPhysics(cornering, { throttle: 0, steer: 1, handbrake: false }, baseConfig, 0.2, 0.5);
    const lateralOf = (s: CarState) => {
      const fwd = { x: Math.cos(s.angle), y: Math.sin(s.angle) };
      const right = { x: -fwd.y, y: fwd.x };
      return Math.abs(s.vx * right.x + s.vy * right.y);
    };
    expect(lateralOf(onGrass)).toBeGreaterThan(lateralOf(onAsphalt));
  });
});

describe('isSkidding', () => {
  it('is false for a stationary car', () => {
    expect(isSkidding(stillState)).toBe(false);
  });

  it('is true when lateral speed dominates', () => {
    const sliding: CarState = { x: 0, y: 0, angle: 0, vx: 0, vy: 100 };
    expect(isSkidding(sliding)).toBe(true);
  });

  it('is false when moving purely forward', () => {
    const straight: CarState = { x: 0, y: 0, angle: 0, vx: 100, vy: 0 };
    expect(isSkidding(straight)).toBe(false);
  });
});
