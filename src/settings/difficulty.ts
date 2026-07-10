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
 * "Difícil" = 1.0/1.0, la potencia y velocidad tal cual las define el JSON
 * del coche. "Normal" y "Fácil" reducen ambas: solo bajar la aceleración no
 * bastaba, porque el coche seguía alcanzando la misma velocidad máxima y
 * costaba igual de manejar en curva (el giro también depende de la
 * velocidad, ver stepCarPhysics). "Fácil" es notablemente más lento y
 * lento para acelerar, pensado para aprender a no perder el control.
 */
export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyTuning> = {
  easy: { label: 'Fácil', accelerationMultiplier: 0.4, speedMultiplier: 0.5 },
  normal: { label: 'Normal', accelerationMultiplier: 0.65, speedMultiplier: 0.75 },
  hard: { label: 'Difícil', accelerationMultiplier: 1.0, speedMultiplier: 1.0 },
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
