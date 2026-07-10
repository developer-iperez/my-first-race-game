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

  it('accepts the optional angle/width on the start_finish waypoint (checkered line geometry)', () => {
    const track = parseTrack(trackFixture);
    const startFinish = track.waypoints.find((w) => w.type === 'start_finish');
    expect(startFinish?.angle).toBe(180);
    expect(startFinish?.width).toBe(64);
  });

  it('still accepts a start_finish waypoint without angle/width (falls back to a marker)', () => {
    const withoutGeometry = {
      ...trackFixture,
      waypoints: (trackFixture.waypoints as Record<string, unknown>[]).map((w) =>
        w.type === 'start_finish' ? { x: w.x, y: w.y, type: w.type } : w,
      ),
    };
    expect(() => parseTrack(withoutGeometry)).not.toThrow();
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
