import { readFileSync } from 'node:fs';
import { parseCar } from '../src/config/schema/car';
import { applyTuningToPhysics, DEFAULT_CAR_TUNING } from '../src/settings/carTuning';
import { evaluateFeelMetrics, formatFeelReport, measureFeel } from '../src/physics/feelMetrics';

/**
 * Informe de "feel" con el coche y el tuning reales por defecto.
 *
 * Uso:
 *   npm run feel
 *   npm run feel -- --strict   # sale con código 1 si alguna métrica falla
 *   npm run feel -- --hz=120   # simula a 120 Hz
 */

const carPath = new URL('../public/cars/rally-hatch.json', import.meta.url);
const car = parseCar(JSON.parse(readFileSync(carPath, 'utf8')));
const physics = applyTuningToPhysics(car.physics, DEFAULT_CAR_TUNING);

const hzArg = process.argv.find((arg) => arg.startsWith('--hz='));
const hz = hzArg ? Number(hzArg.slice('--hz='.length)) : 60;

const metrics = measureFeel(physics, { hz });
console.log(formatFeelReport(metrics));

if (process.argv.includes('--strict')) {
  const failed = evaluateFeelMetrics(metrics).filter((result) => !result.passes);
  if (failed.length > 0) {
    console.error(`\n${failed.length} métrica(s) fuera del objetivo.`);
    process.exitCode = 1;
  }
}
