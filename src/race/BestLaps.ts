const STORAGE_KEY = 'rally90s:bestLaps';

type BestLapsMap = Record<string, number>;

function recordKey(trackKey: string, carKey: string): string {
  return `${trackKey}::${carKey}`;
}

function load(): BestLapsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as BestLapsMap) : {};
  } catch {
    return {};
  }
}

function save(map: BestLapsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage puede no estar disponible (modo privado); no es crítico,
    // simplemente no persiste entre sesiones.
  }
}

/**
 * Mejor vuelta guardada entre sesiones (localStorage), una por combinación
 * de circuito+coche — igual que los datos de circuito/coche son por JSON
 * (§3.7 de ANALISIS.md), esto es una preferencia/progreso del jugador, no
 * parte de la definición del vehículo o el trazado.
 */
export class BestLaps {
  static get(trackKey: string, carKey: string): number | null {
    const value = load()[recordKey(trackKey, carKey)];
    return typeof value === 'number' ? value : null;
  }

  /** Guarda timeMs como récord solo si mejora (o no existe todavía) el guardado. */
  static reportLap(trackKey: string, carKey: string, timeMs: number): void {
    const map = load();
    const key = recordKey(trackKey, carKey);
    const current = map[key];
    if (typeof current !== 'number' || timeMs < current) {
      map[key] = timeMs;
      save(map);
    }
  }
}
