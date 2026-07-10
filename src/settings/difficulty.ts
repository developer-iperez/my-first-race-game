import type { CarPhysicsConfig } from '../config/schema/car';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyTuning {
  label: string;
  /** Multiplicador sobre la potencia del motor (enginePower) del coche. */
  accelerationMultiplier: number;
}

export const DIFFICULTY_LEVELS: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/**
 * "Difícil" = 1.0, la potencia tal cual la define el JSON del coche.
 * "Normal" (por defecto) ya reduce la aceleración para que sea más
 * controlable de entrada; "Fácil" la reduce aún más.
 */
export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyTuning> = {
  easy: { label: 'Fácil', accelerationMultiplier: 0.5 },
  normal: { label: 'Normal', accelerationMultiplier: 0.7 },
  hard: { label: 'Difícil', accelerationMultiplier: 1.0 },
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
  const { accelerationMultiplier } = DIFFICULTY_PRESETS[difficulty];
  return { ...physics, enginePower: physics.enginePower * accelerationMultiplier };
}
