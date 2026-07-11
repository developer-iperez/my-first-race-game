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
  it('scales enginePower and maxSpeed according to the difficulty preset', () => {
    for (const [difficulty, preset] of Object.entries(DIFFICULTY_PRESETS)) {
      const result = applyDifficultyToPhysics(basePhysics, difficulty as keyof typeof DIFFICULTY_PRESETS);
      expect(result.enginePower).toBeCloseTo(basePhysics.enginePower * preset.accelerationMultiplier);
      expect(result.maxSpeed).toBeCloseTo(basePhysics.maxSpeed * preset.speedMultiplier);
    }
  });

  it('leaves every other physics field untouched', () => {
    const result = applyDifficultyToPhysics(basePhysics, 'easy');
    const { enginePower: _enginePower, maxSpeed: _maxSpeed, ...restOfResult } = result;
    const { enginePower: _baseEnginePower, maxSpeed: _baseMaxSpeed, ...restOfBase } = basePhysics;
    expect(restOfResult).toEqual(restOfBase);
  });

  it('"hard" is the fastest level but still capped below the car\'s raw top speed (jugabilidad)', () => {
    // En este circuito, a la velocidad máxima cruda del coche el radio de
    // giro no cabe en las curvas; incluso "Difícil" recorta el tope para
    // que siga siendo tomable, no ingobernable.
    const result = applyDifficultyToPhysics(basePhysics, 'hard');
    expect(result.maxSpeed).toBeLessThan(basePhysics.maxSpeed);
    expect(result.enginePower).toBeLessThan(basePhysics.enginePower);
  });

  it('"easy" is slower and less powerful than "normal", which is less than "hard"', () => {
    const easy = applyDifficultyToPhysics(basePhysics, 'easy');
    const normal = applyDifficultyToPhysics(basePhysics, 'normal');
    const hard = applyDifficultyToPhysics(basePhysics, 'hard');
    expect(easy.enginePower).toBeLessThan(normal.enginePower);
    expect(normal.enginePower).toBeLessThan(hard.enginePower);
    expect(easy.maxSpeed).toBeLessThan(normal.maxSpeed);
    expect(normal.maxSpeed).toBeLessThan(hard.maxSpeed);
  });
});
