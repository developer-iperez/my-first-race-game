import { describe, expect, it } from 'vitest';
import carFixture from '../public/cars/rally-hatch.json';
import { parseCar } from '../src/config/schema/car';
import { applyTuningToPhysics, DEFAULT_CAR_TUNING } from '../src/settings/carTuning';
import {
  FEEL_TARGETS,
  evaluateFeelMetrics,
  formatFeelReport,
  measureFeel,
} from '../src/physics/feelMetrics';

const car = parseCar(carFixture);
const physics = applyTuningToPhysics(car.physics, DEFAULT_CAR_TUNING);

function allFiniteOrNull(values: (number | null)[]): boolean {
  return values.every((value) => value === null || Number.isFinite(value));
}

describe('measureFeel', () => {
  it('mide todas las métricas con el coche y el tuning reales por defecto', () => {
    const metrics = measureFeel(physics);

    expect(metrics.acceleration.timeTo90Pct).toBeGreaterThan(0);
    expect(metrics.acceleration.topSpeed).toBeCloseTo(physics.maxSpeed, 0);
    expect(metrics.braking.timeSeconds).toBeGreaterThan(0);
    expect(metrics.braking.distancePx).toBeGreaterThan(0);
    expect(metrics.coasting.ratioAfter1s).toBeGreaterThan(0);
    expect(metrics.coasting.ratioAfter1s).toBeLessThanOrEqual(1);
    expect(metrics.turning.slowRadiusPx).toBeGreaterThan(0);
    expect(metrics.turning.fastRadiusPx).toBeGreaterThan(0);
    expect(metrics.drift.slipRatio).toBeGreaterThanOrEqual(0);
    expect(metrics.drift.slipRatio).toBeLessThanOrEqual(1);
    expect(metrics.handbrake.slipRatioAtHalfSecond).toBeGreaterThanOrEqual(0);
    expect(metrics.handbrake.slipRatioAtHalfSecond).toBeLessThanOrEqual(1);
    expect(typeof metrics.wall.crossed).toBe('boolean');
  });

  it('es determinista: dos simulaciones idénticas dan los mismos valores', () => {
    const first = measureFeel(physics);
    const second = measureFeel(physics);
    expect(second).toEqual(first);
  });

  it('produce valores finitos a 120 Hz', () => {
    const metrics = measureFeel(physics, { hz: 120 });
    expect(
      allFiniteOrNull([
        metrics.acceleration.timeTo90Pct,
        metrics.braking.timeSeconds,
        metrics.turning.slowRadiusPx,
        metrics.turning.fastRadiusPx,
      ]),
    ).toBe(true);
  });

  it('rechaza una frecuencia de simulación inválida', () => {
    expect(() => measureFeel(physics, { hz: 0 })).toThrow();
  });
});

describe('evaluateFeelMetrics', () => {
  it('devuelve una fila por cada objetivo numérico más el muro', () => {
    const results = evaluateFeelMetrics(measureFeel(physics));
    expect(results).toHaveLength(FEEL_TARGETS.length + 1);
    expect(results.at(-1)?.id).toBe('wall');
    expect(results.every((result) => typeof result.passes === 'boolean')).toBe(true);
  });

  it('el coche de producción cumple todos los objetivos de S1', () => {
    const failed = evaluateFeelMetrics(measureFeel(physics)).filter((result) => !result.passes);
    expect(failed.map((result) => result.id)).toEqual([]);
  });

  it('el informe incluye el estado PASS/FAIL y el recuento final', () => {
    const report = formatFeelReport(measureFeel(physics));
    expect(report).toContain('Feel metrics');
    expect(report).toMatch(/PASS|FAIL/);
    expect(report).toMatch(/métricas dentro del objetivo/);
  });
});
