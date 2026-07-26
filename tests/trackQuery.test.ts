import { describe, expect, it } from 'vitest';
import { getSurfaceDragAt, getSurfaceGripAt, isWallAt } from '../src/track/TrackQuery';
import type { TrackDefinition } from '../src/config/schema/track';

const track: TrackDefinition = {
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
  waypoints: [{ x: 8, y: 8, type: 'start_finish' }],
  laps: 1,
  theme: 'test',
};

describe('TrackQuery', () => {
  it('reads grip and drag from the surface under a position', () => {
    expect(getSurfaceGripAt(track, 8, 8)).toBe(1);
    expect(getSurfaceDragAt(track, 8, 8)).toBe(1);
    expect(getSurfaceGripAt(track, 24, 8)).toBe(0.6);
    expect(getSurfaceDragAt(track, 24, 8)).toBe(1.06);
  });

  it('treats out-of-bounds positions as zero grip and high drag (car slows instead of sliding freely)', () => {
    expect(getSurfaceGripAt(track, -1, 8)).toBe(0);
    expect(getSurfaceDragAt(track, 1000, 8)).toBeGreaterThan(1.06);
  });

  it('reads the walls layer', () => {
    expect(isWallAt(track, 24, 24)).toBe(true);
    expect(isWallAt(track, 8, 8)).toBe(false);
  });
});
