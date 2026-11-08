/**
 * Datos de presentación del coche para el HUD: velocidad en km/h, marcha y
 * RPM. Es lógica pura para poder testearla sin Phaser.
 *
 * La escala px/s → km/h es de arcade (0,5): la velocidad máxima por defecto
 * (312 px/s con el tuning actual) se muestra como ~156 km/h. No pretende ser
 * una conversión física real.
 */

export const SPEED_TO_KMH = 0.5;

const GEAR_BANDS = [0, 0.18, 0.36, 0.56, 0.78, 1];

export interface DriveDisplay {
  speedKmh: number;
  /** 0..1 respecto a la velocidad máxima efectiva. */
  speedFraction: number;
  /** 1..5. */
  gear: number;
  /** 0..1 dentro de la marcha actual. */
  rpm: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getDriveDisplay(speed: number, maxSpeed: number): DriveDisplay {
  const speedFraction = clamp(maxSpeed > 0 ? speed / maxSpeed : 0, 0, 1);

  let gear = 1;
  for (let i = 1; i < GEAR_BANDS.length - 1; i++) {
    if (speedFraction >= GEAR_BANDS[i]) gear = i + 1;
  }

  const bandStart = GEAR_BANDS[gear - 1];
  const bandEnd = GEAR_BANDS[gear];
  const rpm = clamp((speedFraction - bandStart) / (bandEnd - bandStart), 0, 1);

  return {
    speedKmh: speed * SPEED_TO_KMH,
    speedFraction,
    gear,
    rpm,
  };
}

/** Delta con signo para comparar una vuelta con la mejor: +0.456 / -1.234. */
export function formatSignedDelta(deltaMs: number): string {
  const sign = deltaMs >= 0 ? '+' : '-';
  return `${sign}${(Math.abs(deltaMs) / 1000).toFixed(3)}`;
}
