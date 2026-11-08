import { describe, expect, it } from 'vitest';
import { applyTuningToPhysics, CAR_TUNING_BOUNDS, DEFAULT_CAR_TUNING } from '../src/settings/carTuning';
import type { CarPhysicsConfig } from '../src/config/schema/car';

const basePhysics: CarPhysicsConfig = {
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

describe('applyTuningToPhysics', () => {
  it('scales enginePower, maxSpeed and gripLateral by the given factors', () => {
    const result = applyTuningToPhysics(basePhysics, { speedFactor: 0.5, accelFactor: 0.4, gripFactor: 0.8 });
    expect(result.maxSpeed).toBeCloseTo(130);
    expect(result.enginePower).toBeCloseTo(360);
    expect(result.gripLateral).toBeCloseTo(0.72);
  });

  it('leaves every other physics field untouched', () => {
    const result = applyTuningToPhysics(basePhysics, DEFAULT_CAR_TUNING);
    const { enginePower: _e, maxSpeed: _m, gripLateral: _g, ...restOfResult } = result;
    const { enginePower: _be, maxSpeed: _bm, gripLateral: _bg, ...restOfBase } = basePhysics;
    expect(restOfResult).toEqual(restOfBase);
  });

  it('clamps gripLateral to [0, 1] even if a factor would push it out of range', () => {
    const result = applyTuningToPhysics(basePhysics, { ...DEFAULT_CAR_TUNING, gripFactor: 2 });
    expect(result.gripLateral).toBeLessThanOrEqual(1);
  });

  it('the default tuning reproduces the car grip unmodified (gripFactor 1 = sin cambios)', () => {
    const result = applyTuningToPhysics(basePhysics, DEFAULT_CAR_TUNING);
    expect(result.gripLateral).toBeCloseTo(basePhysics.gripLateral);
  });

  it("every bound's default value sits within its own [min, max] range", () => {
    for (const bounds of Object.values(CAR_TUNING_BOUNDS)) {
      expect(bounds.default).toBeGreaterThanOrEqual(bounds.min);
      expect(bounds.default).toBeLessThanOrEqual(bounds.max);
    }
  });
});
