import { describe, expect, it } from 'vitest';
import { formatSignedDelta, getDriveDisplay, SPEED_TO_KMH } from '../src/race/driveDisplay';

describe('getDriveDisplay', () => {
  it('convierte px/s a km/h de arcade', () => {
    expect(getDriveDisplay(312, 312).speedKmh).toBeCloseTo(312 * SPEED_TO_KMH);
  });

  it('empieza en primera y termina en quinta', () => {
    expect(getDriveDisplay(0, 312).gear).toBe(1);
    expect(getDriveDisplay(312, 312).gear).toBe(5);
  });

  it('la marcha sube con la velocidad y la RPM se queda entre 0 y 1', () => {
    const gears = [0.1, 0.25, 0.45, 0.65, 0.9].map((fraction) =>
      getDriveDisplay(312 * fraction, 312),
    );

    expect(gears.map((display) => display.gear)).toEqual([1, 2, 3, 4, 5]);
    for (const display of gears) {
      expect(display.rpm).toBeGreaterThanOrEqual(0);
      expect(display.rpm).toBeLessThanOrEqual(1);
    }
  });

  it('no explota si el coche está parado o maxSpeed es 0', () => {
    expect(getDriveDisplay(0, 0)).toMatchObject({ speedKmh: 0, gear: 1, rpm: 0 });
  });
});

describe('formatSignedDelta', () => {
  it('muestra el signo y los milisegundos con 3 decimales', () => {
    expect(formatSignedDelta(456)).toBe('+0.456');
    expect(formatSignedDelta(-1234)).toBe('-1.234');
    expect(formatSignedDelta(0)).toBe('+0.000');
  });
});
