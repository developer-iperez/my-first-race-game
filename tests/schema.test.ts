import { describe, expect, it } from 'vitest';
import { parseTrack } from '../src/config/schema/track';
import { parseCar } from '../src/config/schema/car';
import trackFixture from '../public/tracks/rally-01.json';
import carFixture from '../public/cars/rally-hatch.json';

describe('parseTrack', () => {
  it('accepts the shipped example track', () => {
    expect(() => parseTrack(trackFixture)).not.toThrow();
  });

  it('rejects a track with an unsupported schemaVersion', () => {
    expect(() => parseTrack({ ...trackFixture, schemaVersion: 2 })).toThrow();
  });

  it('rejects a track missing required fields', () => {
    const { spawn: _spawn, ...withoutSpawn } = trackFixture as Record<string, unknown>;
    expect(() => parseTrack(withoutSpawn)).toThrow();
  });
});

describe('parseCar', () => {
  it('accepts the shipped example car', () => {
    expect(() => parseCar(carFixture)).not.toThrow();
  });

  it('rejects a car with grip out of the 0..1 range', () => {
    const invalid = {
      ...carFixture,
      physics: { ...carFixture.physics, gripLateral: 1.5 },
    };
    expect(() => parseCar(invalid)).toThrow();
  });

  it('rejects a car with a malformed skidColor', () => {
    const invalid = {
      ...carFixture,
      appearance: { ...carFixture.appearance, skidColor: 'not-a-color' },
    };
    expect(() => parseCar(invalid)).toThrow();
  });
});
