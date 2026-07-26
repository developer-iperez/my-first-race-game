import type { TrackDefinition } from '../config/schema/track';

const OUT_OF_BOUNDS_DRAG = 4;

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

/**
 * Resistencia al avance de la superficie bajo una posición del mundo
 * (1 = normal, más alto = frena más). Fuera de mapa: resistencia alta fija,
 * para que salirse del área jugable frene el coche en vez de dejarlo
 * deslizar a velocidad de asfalto contra el borde de la pantalla.
 */
export function getSurfaceDragAt(track: TrackDefinition, x: number, y: number): number {
  const { col, row } = toTileIndex(track, x, y);
  if (!inBounds(track, col, row)) return OUT_OF_BOUNDS_DRAG;
  const surfaceKey = track.layers.surface[row][col];
  return track.surfaces[surfaceKey]?.drag ?? 1;
}

/** Si la posición del mundo cae sobre un tile de muro (colisión). */
export function isWallAt(track: TrackDefinition, x: number, y: number): boolean {
  const { col, row } = toTileIndex(track, x, y);
  if (!inBounds(track, col, row)) return true;
  return track.layers.walls[row][col] === 1;
}
