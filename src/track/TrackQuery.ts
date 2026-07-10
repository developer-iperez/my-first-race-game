import type { TrackDefinition } from '../config/schema/track';

/** Convierte una coordenada de mundo (px) en índices de la rejilla de tiles. */
function toTileIndex(track: TrackDefinition, x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor(x / track.tileSize),
    row: Math.floor(y / track.tileSize),
  };
}

function inBounds(track: TrackDefinition, col: number, row: number): boolean {
  return row >= 0 && row < track.layers.surface.length && col >= 0 && col < track.layers.surface[row].length;
}

/** Agarre de la superficie bajo una posición del mundo (1 = normal). Fuera de mapa: sin agarre. */
export function getSurfaceGripAt(track: TrackDefinition, x: number, y: number): number {
  const { col, row } = toTileIndex(track, x, y);
  if (!inBounds(track, col, row)) return 0;
  const surfaceKey = track.layers.surface[row][col];
  return track.surfaces[surfaceKey]?.grip ?? 1;
}

/** Si la posición del mundo cae sobre un tile de muro (colisión). */
export function isWallAt(track: TrackDefinition, x: number, y: number): boolean {
  const { col, row } = toTileIndex(track, x, y);
  if (!inBounds(track, col, row)) return true;
  return track.layers.walls[row][col] === 1;
}
