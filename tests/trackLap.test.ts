import { describe, expect, it } from 'vitest';
import rally01 from '../public/tracks/rally-01.json';
import rally02 from '../public/tracks/rally-02.json';
import rally03 from '../public/tracks/rally-03.json';
import { LapTracker } from '../src/race/LapTracker';
import type { Waypoint } from '../src/config/schema/track';

interface TiledProperty {
  name: string;
  value: unknown;
}

interface TiledObject {
  type: string;
  x: number;
  y: number;
  properties?: TiledProperty[];
}

interface TiledTrack {
  properties: TiledProperty[];
  layers: { name: string; objects?: TiledObject[] }[];
}

const tracks: Record<string, TiledTrack> = {
  'rally-01': rally01 as unknown as TiledTrack,
  'rally-02': rally02 as unknown as TiledTrack,
  'rally-03': rally03 as unknown as TiledTrack,
};

function property(object: TiledObject, name: string): unknown {
  return object.properties?.find((candidate) => candidate.name === name)?.value;
}

function trackWaypoints(track: TiledTrack): Waypoint[] {
  const layer = track.layers.find((candidate) => candidate.name === 'waypoints');
  if (!layer?.objects) throw new Error('Falta la capa de waypoints');
  return layer.objects
    .filter((object) => object.type !== 'spawn')
    .map((object) => ({
      x: object.x,
      y: object.y,
      type: object.type as Waypoint['type'],
      angle: property(object, 'angle') as number | undefined,
      width: property(object, 'width') as number | undefined,
    }));
}

describe.each(Object.entries(tracks))('%s — una vuelta completa cruza todas las puertas', (name, track) => {
  it('la secuencia start → cp1 → cp2 → cp3 → cp4 → start cuenta una vuelta', () => {
    const waypoints = trackWaypoints(track);
    const laps = Number(track.properties.find((p) => p.name === 'laps')?.value ?? 1);
    const tracker = new LapTracker(waypoints, laps, 80);
    let elapsed = 0;

    // Se recorre cada puerta desde 30 px antes del plano hasta 30 px después.
    // Así se prueba el cruce real de la puerta con los datos del TMJ.
    for (const target of [...waypoints.slice(1), waypoints[0]]) {
      const angle = ((target.angle ?? 0) * Math.PI) / 180;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      const before = {
        x: target.x - direction.x * 30,
        y: target.y - direction.y * 30,
      };
      const after = {
        x: target.x + direction.x * 30,
        y: target.y + direction.y * 30,
      };

      tracker.update(before.x, before.y, direction.x * 100, direction.y * 100, (elapsed += 1000));
      tracker.update(after.x, after.y, direction.x * 100, direction.y * 100, (elapsed += 1000));
    }

    const state = tracker.getState();
    expect(state.lastLapMs, name).not.toBeNull();
    expect(state.currentLap, name).toBe(2);
    expect(tracker.nextTargetIndex, name).toBe(1);
  });
});
