import type { CarPhysicsConfig } from '../config/schema/car';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyTuning {
  label: string;
  /** Multiplicador sobre la potencia del motor (enginePower) del coche. */
  accelerationMultiplier: number;
  /** Multiplicador sobre la velocidad máxima (maxSpeed) del coche. */
  speedMultiplier: number;
}

export const DIFFICULTY_LEVELS: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/**
 * Los tres niveles recortan la velocidad máxima del coche respecto al JSON
 * (que define un tope alto, 260): en este circuito, tan pequeño que se ve
 * entero de una vez, el radio de giro mínimo del coche es proporcional a su
 * velocidad máxima (radio ≈ maxSpeed / turnRate, ver stepCarPhysics), así
 * que a tope el coche no cabe en las curvas y es ingobernable. Bajar el
 * tope aprieta el radio de giro y hace el juego manejable.
 *
 * - "Fácil": lento y suave, para aprender sin perder el control.
 * - "Normal": velocidad media; el derrape se nota en curva pero se maneja.
 * - "Difícil": rápido y más deslizante, para quien ya controla — sigue
 *   siendo tomable, no un tope imposible.
 */
export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyTuning> = {
  easy: { label: 'Fácil', accelerationMultiplier: 0.45, speedMultiplier: 0.42 },
  normal: { label: 'Normal', accelerationMultiplier: 0.6, speedMultiplier: 0.6 },
  hard: { label: 'Difícil', accelerationMultiplier: 0.85, speedMultiplier: 0.73 },
};

/**
 * Aplica la dificultad sobre la configuración física de un coche. Es una
 * capa por encima del propio coche (definido por datos, ver
 * docs/ANALISIS.md §3.7): la dificultad ajusta cómo lo siente el jugador,
 * no redefine el vehículo.
 */
export function applyDifficultyToPhysics(
  physics: CarPhysicsConfig,
  difficulty: Difficulty,
): CarPhysicsConfig {
  const { accelerationMultiplier, speedMultiplier } = DIFFICULTY_PRESETS[difficulty];
  return {
    ...physics,
    enginePower: physics.enginePower * accelerationMultiplier,
    maxSpeed: physics.maxSpeed * speedMultiplier,
  };
}
