import { describe, expect, it } from 'vitest';
import type { CarState } from '../src/physics/carPhysics';
import { resolveCarCollision, type CarCollisionDimensions } from '../src/physics/carCollision';
import type { TrackDefinition } from '../src/config/schema/track';
import { getWallTileRectsInAabb, isWallAt } from '../src/track/TrackQuery';

const dimensions: CarCollisionDimensions = { length: 48, width: 24 };

function makeTrack(wallColumns: number[] = [5]): TrackDefinition {
  const width = 10;
  const height = 10;
  const walls = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
  for (const col of wallColumns) {
    for (let row = 0; row < height; row++) walls[row][col] = 1;
  }

  return {
    schemaVersion: 1,
    id: 'collision-test',
    name: 'Collision Test',
    size: { width: width * 32, height: height * 32 },
    tileSize: 32,
    surfaces: { asphalt: { grip: 1, drag: 1 } },
    layers: {
      surface: Array.from({ length: height }, () => Array.from({ length: width }, () => 'asphalt')),
      walls,
    },
    spawn: { x: 64, y: 176, angle: 0 },
    waypoints: [{ x: 64, y: 176, type: 'start_finish' }],
    laps: 1,
    theme: 'test',
  };
}

function state(partial: Partial<CarState> = {}): CarState {
  return { x: 0, y: 0, angle: 0, vx: 0, vy: 0, yawRate: 0, ...partial };
}

describe('resolveCarCollision', () => {
  it('no atraviesa un muro de 32 px a velocidad máxima, ni siquiera con un paso grande', () => {
    const track = makeTrack([5]);
    const previous = state({ x: 100, y: 176, vx: 312 });
    const next = state({ x: 100 + 312 * 0.25, y: 176, vx: 312 });

    const result = resolveCarCollision(previous, next, track, dimensions);

    expect(result.collided).toBe(true);
    // La mitad delantera del coche mide 24 px: el centro no puede pasar de
    // 160 - 24 = 136 px.
    expect(result.state.x).toBeLessThanOrEqual(136.1);
    expect(result.state.x).toBeGreaterThan(125);
    expect(result.impact).not.toBeNull();
    expect(result.impact?.speed).toBeGreaterThan(200);
  });

  it('no atraviesa un muro grueso de 128 px', () => {
    const track = makeTrack([5, 6, 7, 8]);
    const previous = state({ x: 100, y: 176, vx: 312 });
    const next = state({ x: 100 + 312 * 0.25, y: 176, vx: 312 });

    const result = resolveCarCollision(previous, next, track, dimensions);

    expect(result.collided).toBe(true);
    expect(result.state.x).toBeLessThanOrEqual(136.1);
    expect(isWallAt(track, result.state.x, result.state.y)).toBe(false);
  });

  it('desliza en diagonal: elimina la velocidad contra el muro y conserva la tangencial', () => {
    const track = makeTrack([5]);
    const previous = state({ x: 100, y: 176, vx: 460, vy: 160 });
    const next = state({ x: 146, y: 184, vx: 460, vy: 160 });

    const result = resolveCarCollision(previous, next, track, dimensions);

    expect(result.collided).toBe(true);
    expect(result.state.vx).toBeLessThan(0);
    expect(result.state.vy).toBeGreaterThan(100);
    expect(result.state.y).toBeGreaterThan(previous.y);
  });

  it('desliza a lo largo del muro sin quedarse pegado al estar en contacto', () => {
    const track = makeTrack([5]);
    const previous = state({ x: 136, y: 176, vy: 120 });
    const next = state({ x: 136, y: 178, vy: 120 });

    const result = resolveCarCollision(previous, next, track, dimensions);

    expect(result.collided).toBe(false);
    expect(result.state.y).toBeCloseTo(178, 4);
    expect(result.state.x).toBeCloseTo(136, 4);
  });

  it('si en contacto se mueve contra el muro, no lo atraviesa', () => {
    const track = makeTrack([5]);
    const previous = state({ x: 136, y: 176, vx: 120 });
    const next = state({ x: 138, y: 176, vx: 120 });

    const result = resolveCarCollision(previous, next, track, dimensions);

    expect(result.collided).toBe(true);
    expect(result.state.x).toBeLessThanOrEqual(136.1);
  });

  it('no colisiona si pasa paralelo sin tocar el muro', () => {
    const track = makeTrack([5]);
    const previous = state({ x: 100, y: 100, vx: 100 });
    const next = state({ x: 120, y: 100, vx: 100 });

    const result = resolveCarCollision(previous, next, track, dimensions);

    expect(result.collided).toBe(false);
    expect(result.impact).toBeNull();
    expect(result.state).toEqual(next);
  });

  it('saca el coche si empieza dentro de un muro', () => {
    const track = makeTrack([5]);
    const inside = state({ x: 176, y: 176 });

    const result = resolveCarCollision(inside, inside, track, dimensions);

    expect(result.collided).toBe(true);
    expect(result.state.x).toBeLessThan(150);
    expect(isWallAt(track, result.state.x, result.state.y)).toBe(false);
  });

  it('es estable: repetir la resolución sobre el estado corregido no vuelve a mover el coche', () => {
    const track = makeTrack([5]);
    const previous = state({ x: 100, y: 176, vx: 312 });
    const next = state({ x: 178, y: 176, vx: 312 });
    const first = resolveCarCollision(previous, next, track, dimensions);
    const second = resolveCarCollision(first.state, first.state, track, dimensions);

    expect(second.collided).toBe(false);
    expect(second.state.x).toBeCloseTo(first.state.x, 4);
    expect(second.state.y).toBeCloseTo(first.state.y, 4);
  });
});

describe('getWallTileRectsInAabb', () => {
  it('devuelve solo los tiles de muro que solapan la zona consultada', () => {
    const track = makeTrack([5]);
    const tiles = getWallTileRectsInAabb(track, 150, 160, 180, 180);

    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ col: 5, x: 160, y: 160, width: 32, height: 32 });
  });

  it('devuelve una lista vacía si no hay muros en la zona', () => {
    const track = makeTrack([5]);
    expect(getWallTileRectsInAabb(track, 0, 0, 40, 40)).toEqual([]);
  });
});
