import type { CarPhysicsConfig } from '../config/schema/car';

/**
 * Ajuste de conducción del jugador (reemplaza a los antiguos niveles de
 * "Dificultad"): tres sliders continuos, cada uno una fracción del propio
 * valor del coche activo (definido por datos, ver ANALISIS.md §3.7) — así
 * si algún día hay más de un `car.json`, el ajuste sigue siendo relativo a
 * las características de cada coche, no un número absoluto hardcodeado.
 */
export interface CarTuning {
  /** Fracción de la velocidad máxima del coche (maxSpeed). */
  speedFactor: number;
  /** Fracción de la potencia de motor del coche (enginePower). */
  accelFactor: number;
  /** Fracción del agarre lateral del coche (gripLateral): menos agarre = más derrape. */
  gripFactor: number;
}

export interface TuningBounds {
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/**
 * Límites de cada slider. No son arbitrarios: en este circuito el radio de
 * giro mínimo del coche es proporcional a su velocidad máxima (radio ≈
 * maxSpeed / turnRate — ver docs/CHANGELOG.md, rebalanceo de dificultad),
 * así que `speedFactor` tiene un tope para que el coche siga cabiendo en
 * las curvas incluso al máximo. Los valores por defecto reproducen la
 * antigua dificultad "Normal" (velocidad/aceleración) y el agarre propio
 * del coche sin modificar (agarre 100% = comportamiento de siempre).
 */
export const CAR_TUNING_BOUNDS: Record<keyof CarTuning, TuningBounds> = {
  speedFactor: { label: 'Velocidad máxima', min: 0.3, max: 0.85, step: 0.01, default: 0.6 },
  accelFactor: { label: 'Aceleración', min: 0.3, max: 1, step: 0.01, default: 0.6 },
  gripFactor: { label: 'Agarre (menos = más derrape)', min: 0.55, max: 1.1, step: 0.01, default: 1 },
};

export const DEFAULT_CAR_TUNING: CarTuning = {
  speedFactor: CAR_TUNING_BOUNDS.speedFactor.default,
  accelFactor: CAR_TUNING_BOUNDS.accelFactor.default,
  gripFactor: CAR_TUNING_BOUNDS.gripFactor.default,
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/**
 * Aplica el ajuste de conducción sobre la configuración física de un
 * coche. Es una capa por encima del propio coche (ver ANALISIS.md §3.7):
 * el ajuste cambia cómo lo siente el jugador, no redefine el vehículo.
 */
export function applyTuningToPhysics(physics: CarPhysicsConfig, tuning: CarTuning): CarPhysicsConfig {
  return {
    ...physics,
    enginePower: physics.enginePower * tuning.accelFactor,
    maxSpeed: physics.maxSpeed * tuning.speedFactor,
    // gripLateral está acotado por esquema a [0, 1]; el propio rango de
    // CAR_TUNING_BOUNDS.gripFactor ya lo mantiene dentro con el coche
    // actual, pero se recorta también aquí por si el coche activo cambia.
    gripLateral: clamp(physics.gripLateral * tuning.gripFactor, 0, 1),
  };
}
