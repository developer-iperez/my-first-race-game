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

/** Rectángulo en píxeles de mundo de un tile de muro. */
export interface WallTileRect {
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Devuelve los tiles de muro que solapan un AABB de mundo. Es la consulta que
 * usa la colisión del coche para no recorrer la rejilla entera en cada paso.
 */
export function getWallTileRectsInAabb(
  track: TrackDefinition,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): WallTileRect[] {
  const firstCol = Math.max(0, Math.floor(minX / track.tileSize));
  const lastCol = Math.min(track.layers.surface[0]?.length ?? 0, Math.ceil(maxX / track.tileSize));
  const firstRow = Math.max(0, Math.floor(minY / track.tileSize));
  const lastRow = Math.min(track.layers.surface.length, Math.ceil(maxY / track.tileSize));
  const result: WallTileRect[] = [];

  for (let row = firstRow; row < lastRow; row++) {
    const wallRow = track.layers.walls[row];
    if (!wallRow) continue;
    for (let col = firstCol; col < lastCol; col++) {
      if (wallRow[col] !== 1) continue;
      result.push({
        col,
        row,
        x: col * track.tileSize,
        y: row * track.tileSize,
        width: track.tileSize,
        height: track.tileSize,
      });
    }
  }

  return result;
}
