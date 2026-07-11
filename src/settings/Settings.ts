import type { Difficulty } from './difficulty';

export interface GameSettings {
  difficulty: Difficulty;
  soundEnabled: boolean;
  // Futuros ajustes (volumen, layout de controles, coche elegido...) se
  // añaden aquí como una clave más; el resto del sistema (persistencia,
  // pub-sub, menú) no cambia.
}

const STORAGE_KEY = 'rally90s:settings';

const DEFAULTS: GameSettings = {
  difficulty: 'normal',
  soundEnabled: true,
};

/**
 * Ajustes del jugador: preferencias que persisten entre partidas (no son
 * datos de circuito/coche, ver docs/ANALISIS.md §3.7 — esos son datos
 * versionados por vehículo/pista; esto es "cómo quiero jugar yo").
 * Se guardan en localStorage y notifican a quien esté suscrito cuando
 * cambian, para poder aplicarlos en caliente sin recargar la página.
 */
export class Settings {
  private static current: GameSettings = Settings.load();
  private static listeners = new Set<(settings: GameSettings) => void>();

  static get(): GameSettings {
    return { ...Settings.current };
  }

  static update(partial: Partial<GameSettings>): void {
    Settings.current = { ...Settings.current, ...partial };
    Settings.save();
    Settings.listeners.forEach((listener) => listener(Settings.get()));
  }

  /** Devuelve una función para cancelar la suscripción. */
  static onChange(listener: (settings: GameSettings) => void): () => void {
    Settings.listeners.add(listener);
    return () => Settings.listeners.delete(listener);
  }

  private static load(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private static save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Settings.current));
    } catch {
      // localStorage puede no estar disponible (modo privado); no es crítico.
    }
  }
}
