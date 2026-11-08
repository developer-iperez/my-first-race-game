import { describe, expect, it } from 'vitest';
import { formatMedal, getMedal } from '../src/race/medals';

const medals = { goldMs: 90_000, silverMs: 110_000, bronzeMs: 130_000 };

describe('getMedal', () => {
  it('devuelve oro, plata o bronce según el tiempo total', () => {
    expect(getMedal(80_000, medals)).toBe('gold');
    expect(getMedal(100_000, medals)).toBe('silver');
    expect(getMedal(120_000, medals)).toBe('bronze');
  });

  it('devuelve null si se supera el bronce o no hay datos', () => {
    expect(getMedal(140_000, medals)).toBeNull();
    expect(getMedal(80_000, undefined)).toBeNull();
  });
});

describe('formatMedal', () => {
  it('formatea la medalla para resultados', () => {
    expect(formatMedal('gold')).toBe('ORO');
    expect(formatMedal('silver')).toBe('PLATA');
    expect(formatMedal('bronze')).toBe('BRONCE');
    expect(formatMedal(null)).toBe('SIN MEDALLA');
  });
});
