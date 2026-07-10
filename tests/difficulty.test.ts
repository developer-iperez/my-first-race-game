import { describe, expect, it } from 'vitest';
import { applyDifficultyToPhysics, DIFFICULTY_PRESETS } from '../src/settings/difficulty';
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

describe('applyDifficultyToPhysics', () => {
  it('scales enginePower according to the difficulty preset', () => {
    for (const [difficulty, preset] of Object.entries(DIFFICULTY_PRESETS)) {
      const result = applyDifficultyToPhysics(basePhysics, difficulty as keyof typeof DIFFICULTY_PRESETS);
      expect(result.enginePower).toBeCloseTo(basePhysics.enginePower * preset.accelerationMultiplier);
    }
  });

  it('leaves every other physics field untouched', () => {
    const result = applyDifficultyToPhysics(basePhysics, 'easy');
    const { enginePower: _enginePower, ...restOfResult } = result;
    const { enginePower: _baseEnginePower, ...restOfBase } = basePhysics;
    expect(restOfResult).toEqual(restOfBase);
  });

  it('"hard" keeps the car\'s own engine power unchanged', () => {
    const result = applyDifficultyToPhysics(basePhysics, 'hard');
    expect(result.enginePower).toBe(basePhysics.enginePower);
  });

  it('"easy" is less powerful than "normal", which is less powerful than "hard"', () => {
    const easy = applyDifficultyToPhysics(basePhysics, 'easy');
    const normal = applyDifficultyToPhysics(basePhysics, 'normal');
    const hard = applyDifficultyToPhysics(basePhysics, 'hard');
    expect(easy.enginePower).toBeLessThan(normal.enginePower);
    expect(normal.enginePower).toBeLessThan(hard.enginePower);
  });
});
