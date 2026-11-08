import { describe, expect, it } from 'vitest';
import type { TrackDefinition } from '../src/config/schema/track';
import { getSurfaceAt, sampleCarSurfaces } from '../src/track/TrackQuery';

const track: TrackDefinition = {
  schemaVersion: 1,
  id: 'surface-test',
  name: 'Surface Test',
  size: { width: 128, height: 64 },
  tileSize: 32,
  surfaces: {
    asphalt: { grip: 1, drag: 1 },
    grass: { grip: 0.6, drag: 1.06 },
    sand: { grip: 0.75, drag: 1.12 },
  },
  layers: {
    surface: [
      ['asphalt', 'asphalt', 'grass', 'sand'],
      ['asphalt', 'asphalt', 'grass', 'sand'],
    ],
    walls: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  spawn: { x: 16, y: 16, angle: 0 },
  waypoints: [{ x: 16, y: 16, type: 'start_finish' }],
  laps: 1,
  theme: 'test',
};

const sampling = { length: 48, width: 24, wheelbaseOffset: 12 };

describe('getSurfaceAt', () => {
  it('devuelve grip, drag y clave de la superficie', () => {
    expect(getSurfaceAt(track, 16, 16)).toEqual({
      surfaceKey: 'asphalt',
      grip: 1,
      drag: 1,
    });
    expect(getSurfaceAt(track, 112, 16)).toEqual({
      surfaceKey: 'sand',
      grip: 0.75,
      drag: 1.12,
    });
  });

  it('fuera del mapa devuelve superficie offtrack sin agarre y con drag alto', () => {
    expect(getSurfaceAt(track, -1, 16)).toEqual({
      surfaceKey: 'offtrack',
      grip: 0,
      drag: 4,
    });
  });
});

describe('sampleCarSurfaces', () => {
  it('promedia las 4 ruedas al cruzar de asfalto a hierba', () => {
    const sample = sampleCarSurfaces(track, 64, 32, 0, sampling);

    expect(sample.wheels).toHaveLength(4);
    expect(sample.wheels.map((wheel) => wheel.surfaceKey)).toEqual([
      'grass',
      'grass',
      'asphalt',
      'asphalt',
    ]);
    expect(sample.grip).toBeCloseTo(0.8);
    expect(sample.drag).toBeCloseTo(1.03);
    expect(['grass', 'asphalt']).toContain(sample.surfaceKey);
  });

  it('detecta las 4 ruedas sobre arena', () => {
    const sample = sampleCarSurfaces(track, 112, 32, 0, sampling);

    expect(sample.surfaceKey).toBe('sand');
    expect(sample.grip).toBeCloseTo(0.75);
    expect(sample.drag).toBeCloseTo(1.12);
    expect(sample.wheels.every((wheel) => wheel.surfaceKey === 'sand')).toBe(true);
  });

  it('una rueda fuera del mapa baja el agarre medio', () => {
    const sample = sampleCarSurfaces(track, 4, 16, Math.PI / 2, sampling);

    expect(sample.wheels.some((wheel) => wheel.surfaceKey === 'offtrack')).toBe(true);
    expect(sample.grip).toBeLessThan(1);
    expect(sample.drag).toBeGreaterThan(1);
  });
});
