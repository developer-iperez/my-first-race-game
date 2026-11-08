const STORAGE_KEY = 'rally90s:ghosts';

/** [tiempo relativo ms, x, y, ángulo] */
export type GhostFrame = [number, number, number, number];

export interface StoredGhost {
  version: 1;
  lapMs: number;
  frames: GhostFrame[];
}

type GhostMap = Record<string, StoredGhost>;

function recordKey(trackKey: string, carKey: string, tuningKey: string): string {
  return `${trackKey}::${carKey}::${tuningKey}`;
}

function isGhost(value: unknown): value is StoredGhost {
  if (!value || typeof value !== 'object') return false;
  const ghost = value as Partial<StoredGhost>;
  return (
    ghost.version === 1 &&
    typeof ghost.lapMs === 'number' &&
    ghost.lapMs > 0 &&
    Array.isArray(ghost.frames) &&
    ghost.frames.length > 0 &&
    ghost.frames.every(
      (frame) =>
        Array.isArray(frame) &&
        frame.length === 4 &&
        frame.every((value) => typeof value === 'number' && Number.isFinite(value)),
    )
  );
}

function load(): GhostMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as GhostMap) : {};
  } catch {
    return {};
  }
}

function save(map: GhostMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage lleno o no disponible: se pierde el fantasma, no la partida.
  }
}

/**
 * Fantasma de la mejor vuelta (localStorage), separado por circuito, coche y
 * configuración de conducción. Se guarda como frames compactos para no
 * llenar el almacenamiento.
 */
export class GhostStore {
  static get(trackKey: string, carKey: string, tuningKey: string): StoredGhost | null {
    const ghost = load()[recordKey(trackKey, carKey, tuningKey)];
    return isGhost(ghost) ? ghost : null;
  }

  static save(
    trackKey: string,
    carKey: string,
    tuningKey: string,
    ghost: StoredGhost,
  ): void {
    if (!isGhost(ghost)) return;
    const map = load();
    const key = recordKey(trackKey, carKey, tuningKey);
    map[key] = ghost;

    // Los sliders de tuning permiten muchas combinaciones; se limita el
    // número de fantasmas para no llenar localStorage (cada uno puede pesar
    // decenas de KB). Se descarta el más antiguo por orden de inserción.
    const MAX_GHOSTS = 12;
    while (Object.keys(map).length > MAX_GHOSTS) {
      const oldest = Object.keys(map).find((candidate) => candidate !== key);
      if (!oldest) break;
      delete map[oldest];
    }

    save(map);
  }
}
