import { describe, expect, it } from 'vitest';
import { parseTrack } from '../src/config/schema/track';
import { parseCar } from '../src/config/schema/car';
import carFixture from '../public/cars/rally-hatch.json';

// public/tracks/*.json ya no tienen esta forma (son .tmj de Tiled, ver
// TiledMapAdapter.ts): parseTrack se sigue probando aquí contra un objeto
// con la forma de TrackDefinition, que es lo que realmente valida — el
// adaptador de Tiled es quien produce ese objeto en tiempo de ejecución.
const trackFixture = {
  schemaVersion: 1,
  id: 'test',
  name: 'Test',
  size: { width: 32, height: 16 },
  tileSize: 16,
  surfaces: {
    asphalt: { grip: 1, drag: 1 },
    grass: { grip: 0.6, drag: 1.06 },
  },
  layers: {
    surface: [
      ['asphalt', 'grass'],
      ['grass', 'grass'],
    ],
    walls: [
      [0, 0],
      [0, 1],
    ],
  },
  spawn: { x: 8, y: 8, angle: 0 },
  waypoints: [
    { x: 8, y: 8, type: 'start_finish', angle: 0, width: 128 },
    { x: 24, y: 8, type: 'checkpoint' },
  ],
  laps: 3,
  theme: 'test',
};

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
    expect(startFinish?.angle).toBe(0);
    expect(startFinish?.width).toBe(128);
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
