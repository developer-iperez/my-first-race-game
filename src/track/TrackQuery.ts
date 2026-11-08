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

export interface SurfaceSample {
  surfaceKey: string;
  grip: number;
  drag: number;
}

export interface CarSurfaceSampling {
  length: number;
  width: number;
  wheelbaseOffset: number;
}

export interface CarSurfaceSample extends SurfaceSample {
  /** Muestras de las 4 ruedas (delantera/trasera × izquierda/derecha). */
  wheels: SurfaceSample[];
}

/** Superficie bajo una posición del mundo. Fuera de mapa: sin agarre y drag alto. */
export function getSurfaceAt(track: TrackDefinition, x: number, y: number): SurfaceSample {
  const { col, row } = toTileIndex(track, x, y);
  if (!inBounds(track, col, row)) {
    return { surfaceKey: 'offtrack', grip: 0, drag: OUT_OF_BOUNDS_DRAG };
  }
  const surfaceKey = track.layers.surface[row][col];
  const surface = track.surfaces[surfaceKey];
  return {
    surfaceKey,
    grip: surface?.grip ?? 1,
    drag: surface?.drag ?? 1,
  };
}

/** Agarre de la superficie bajo una posición del mundo (1 = normal). */
export function getSurfaceGripAt(track: TrackDefinition, x: number, y: number): number {
  return getSurfaceAt(track, x, y).grip;
}

/**
 * Resistencia al avance de la superficie bajo una posición del mundo
 * (1 = normal, más alto = frena más). Fuera de mapa: resistencia alta fija,
 * para que salirse del área jugable frene el coche en vez de dejarlo
 * deslizar a velocidad de asfalto contra el borde de la pantalla.
 */
export function getSurfaceDragAt(track: TrackDefinition, x: number, y: number): number {
  return getSurfaceAt(track, x, y).drag;
}

function dominantSurfaceKey(wheels: SurfaceSample[]): string {
  const counts = new Map<string, number>();
  for (const wheel of wheels) {
    counts.set(wheel.surfaceKey, (counts.get(wheel.surfaceKey) ?? 0) + 1);
  }

  let best = wheels[0]?.surfaceKey ?? 'asphalt';
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Muestrea el agarre y el drag en las 4 ruedas del coche. Usar solo el
 * centro permitía tener medio chasis en hierba sin que se notara; con las
 * ruedas, cruzar un bordillo o poner dos ruedas en arena cambia el coche.
 */
export function sampleCarSurfaces(
  track: TrackDefinition,
  x: number,
  y: number,
  angle: number,
  sampling: CarSurfaceSampling,
): CarSurfaceSample {
  const halfWidth = Math.max(0, sampling.width / 2);
  const wheelOffset =
    sampling.wheelbaseOffset > 0
      ? sampling.wheelbaseOffset
      : Math.max(0, sampling.length / 2 - halfWidth);

  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);
  const rightX = -forwardY;
  const rightY = forwardX;

  const positions = [
    { longitudinal: wheelOffset, lateral: -halfWidth },
    { longitudinal: wheelOffset, lateral: halfWidth },
    { longitudinal: -wheelOffset, lateral: -halfWidth },
    { longitudinal: -wheelOffset, lateral: halfWidth },
  ];

  const wheels = positions.map((position) => {
    const wheelX = x + forwardX * position.longitudinal + rightX * position.lateral;
    const wheelY = y + forwardY * position.longitudinal + rightY * position.lateral;
    return getSurfaceAt(track, wheelX, wheelY);
  });

  const grip = wheels.reduce((sum, wheel) => sum + wheel.grip, 0) / wheels.length;
  const drag = wheels.reduce((sum, wheel) => sum + wheel.drag, 0) / wheels.length;

  return {
    surfaceKey: dominantSurfaceKey(wheels),
    grip,
    drag,
    wheels,
  };
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
