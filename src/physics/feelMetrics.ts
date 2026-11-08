import type { CarPhysicsConfig } from '../config/schema/car';
import type { TrackDefinition } from '../config/schema/track';
import { stepCarPhysics, type CarInput, type CarState } from './carPhysics';
import { resolveCarCollision } from './carCollision';

/**
 * Métricas objetivas de "feel" para tunear la conducción sin depender solo de
 * la impresión al jugar. La simulación es pura: mismo coche, mismo input y
 * mismo framerate => mismos números. Se usa desde `npm run feel` y desde los
 * tests de aceptación.
 *
 * Los objetivos salen de docs/AUDITORIA.md §1 y docs/PLAN_IMPLEMENTACION.md
 * (Sprint 1). Mientras el modelo siga siendo el actual, el informe mostrará
 * varios FAIL a propósito: son la lista de trabajo del re-tuning.
 */

export interface FeelOptions {
  /** Frecuencia de simulación. Por defecto 60 Hz, igual que la auditoría. */
  hz?: number;
}

export interface AccelerationMetrics {
  timeTo25Pct: number | null;
  timeTo50Pct: number | null;
  timeTo75Pct: number | null;
  timeTo90Pct: number | null;
  timeTo99Pct: number | null;
  timeTo100Pct: number | null;
  topSpeed: number;
}

export interface BrakingMetrics {
  timeSeconds: number;
  distancePx: number;
}

export interface CoastingMetrics {
  speedAfter1s: number;
  ratioAfter1s: number;
}

export interface TurningMetrics {
  slowRadiusPx: number | null;
  fastRadiusPx: number | null;
}

export interface DriftMetrics {
  slipRatio: number;
  slipAngleDeg: number;
  speed: number;
}

export interface HandbrakeMetrics {
  slipRatioAtHalfSecond: number;
  speedAtHalfSecond: number;
  recoveryTimeSeconds: number | null;
}

export interface WallMetrics {
  /** `true` si el coche consigue atravesar un muro de 128 px con gas. */
  crossed: boolean;
  timeSeconds: number | null;
}

export interface FeelMetrics {
  acceleration: AccelerationMetrics;
  braking: BrakingMetrics;
  coasting: CoastingMetrics;
  turning: TurningMetrics;
  drift: DriftMetrics;
  handbrake: HandbrakeMetrics;
  wall: WallMetrics;
}

export interface FeelTargetResult {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  targetText: string;
  passes: boolean;
}

interface NumericTarget {
  id: string;
  label: string;
  /** Valor mínimo aceptado. */
  min: number;
  /** Valor máximo aceptado. */
  max: number;
  unit: string;
}

export const FEEL_TARGETS: NumericTarget[] = [
  { id: 'accel-90', label: '0 → 90% velocidad', min: 2.5, max: 4, unit: 's' },
  { id: 'brake-time', label: 'Frenada 100% → 0', min: 0.6, max: 1, unit: 's' },
  { id: 'brake-distance', label: 'Distancia de frenada', min: 120, max: 200, unit: 'px' },
  { id: 'coast-1s', label: 'Velocidad conservada tras 1 s', min: 0.7, max: 0.8, unit: '×' },
  { id: 'turn-slow', label: 'Radio de giro lento', min: 60, max: 80, unit: 'px' },
  { id: 'turn-fast', label: 'Radio de giro rápido', min: 140, max: 200, unit: 'px' },
  { id: 'drift', label: 'Derrape a fondo + gas', min: 0.25, max: 0.4, unit: '×' },
  { id: 'handbrake', label: 'Derrape con freno de mano', min: 0.45, max: 0.6, unit: '×' },
  { id: 'recovery', label: 'Recuperación tras freno de mano', min: 0.3, max: 0.6, unit: 's' },
];

const DEFAULT_HZ = 60;
const MAX_SIM_SECONDS = 15;
const WALL_TILE_SIZE = 32;
const WALL_START_COLUMN = 5;
const WALL_END_COLUMN = 9; // 4 columnas = 128 px de grosor
const WALL_END_X = WALL_END_COLUMN * WALL_TILE_SIZE;

function stillState(): CarState {
  return { x: 0, y: 0, angle: 0, vx: 0, vy: 0, yawRate: 0 };
}

function movingState(speed: number): CarState {
  return { x: 0, y: 0, angle: 0, vx: speed, vy: 0, yawRate: 0 };
}

function speedOf(state: CarState): number {
  return Math.hypot(state.vx, state.vy);
}

function forwardSpeedOf(state: CarState): number {
  const forward = { x: Math.cos(state.angle), y: Math.sin(state.angle) };
  return state.vx * forward.x + state.vy * forward.y;
}

function slipRatioOf(state: CarState): number {
  const speed = speedOf(state);
  if (speed < 1e-6) return 0;
  const forward = { x: Math.cos(state.angle), y: Math.sin(state.angle) };
  const right = { x: -forward.y, y: forward.x };
  const lateral = Math.abs(state.vx * right.x + state.vy * right.y);
  return lateral / speed;
}

function slipAngleDegOf(state: CarState): number {
  const forward = { x: Math.cos(state.angle), y: Math.sin(state.angle) };
  const right = { x: -forward.y, y: forward.x };
  const forwardSpeed = Math.abs(state.vx * forward.x + state.vy * forward.y);
  const lateralSpeed = Math.abs(state.vx * right.x + state.vy * right.y);
  if (forwardSpeed < 1e-6) return lateralSpeed > 1e-6 ? 90 : 0;
  return (Math.atan2(lateralSpeed, forwardSpeed) * 180) / Math.PI;
}

function simulate(
  initial: CarState,
  input: CarInput,
  config: CarPhysicsConfig,
  frames: number,
  dt: number,
): CarState {
  let state = initial;
  for (let i = 0; i < frames; i++) {
    state = stepCarPhysics(state, input, config, dt);
  }
  return state;
}

function measureAcceleration(config: CarPhysicsConfig, dt: number): AccelerationMetrics {
  const still = stillState();
  const milestones = new Map<number, number | null>([
    [0.25, null],
    [0.5, null],
    [0.75, null],
    [0.9, null],
    [0.99, null],
    [1, null],
  ]);

  let state = still;
  let elapsed = 0;
  const maxFrames = Math.ceil(MAX_SIM_SECONDS / dt);

  for (let i = 0; i < maxFrames; i++) {
    state = stepCarPhysics(state, { throttle: 1, steer: 0, handbrake: false }, config, dt);
    elapsed += dt;
    const speed = speedOf(state);

    for (const [fraction, time] of milestones) {
      if (time === null && speed >= config.maxSpeed * fraction) {
        milestones.set(fraction, elapsed);
      }
    }

    if (speed >= config.maxSpeed * 0.999) break;
  }

  return {
    timeTo25Pct: milestones.get(0.25) ?? null,
    timeTo50Pct: milestones.get(0.5) ?? null,
    timeTo75Pct: milestones.get(0.75) ?? null,
    timeTo90Pct: milestones.get(0.9) ?? null,
    timeTo99Pct: milestones.get(0.99) ?? null,
    timeTo100Pct: milestones.get(1) ?? null,
    topSpeed: speedOf(state),
  };
}

function measureBraking(config: CarPhysicsConfig, dt: number): BrakingMetrics {
  let state = movingState(config.maxSpeed);
  let elapsed = 0;
  let distance = 0;
  const maxFrames = Math.ceil(MAX_SIM_SECONDS / dt);

  for (let i = 0; i < maxFrames; i++) {
    const previous = state;
    state = stepCarPhysics(state, { throttle: -1, steer: 0, handbrake: false }, config, dt);
    elapsed += dt;
    distance += Math.hypot(state.x - previous.x, state.y - previous.y);

    // Se mide hasta detenerse, no hasta empezar a retroceder: con el modelo
    // actual, mantener "atrás" acaba metiendo marcha atrás.
    if (forwardSpeedOf(state) <= 0 || speedOf(state) < 0.5) break;
  }

  return { timeSeconds: elapsed, distancePx: distance };
}

function measureCoasting(config: CarPhysicsConfig, dt: number): CoastingMetrics {
  const frames = Math.round(1 / dt);
  const state = simulate(
    movingState(config.maxSpeed),
    { throttle: 0, steer: 0, handbrake: false },
    config,
    frames,
    dt,
  );
  const speedAfter1s = speedOf(state);
  return {
    speedAfter1s,
    ratioAfter1s: config.maxSpeed > 0 ? speedAfter1s / config.maxSpeed : 0,
  };
}

/**
 * Radio de giro efectivo a una velocidad: se calienta el giro durante 0,2 s y
 * se mide la media de velocidad / |yawRate| durante los siguientes 0,2 s. No
 * busca el régimen perfecto, sino capturar la respuesta real del coche.
 */
function turningRadiusAt(config: CarPhysicsConfig, speed: number, dt: number): number | null {
  const input = { throttle: 0, steer: 1, handbrake: false };
  const warmupFrames = Math.max(1, Math.round(0.2 / dt));
  const measureFrames = Math.max(1, Math.round(0.2 / dt));

  let state = movingState(speed);
  for (let i = 0; i < warmupFrames; i++) {
    state = stepCarPhysics(state, input, config, dt);
  }

  let totalSpeed = 0;
  let totalYaw = 0;
  for (let i = 0; i < measureFrames; i++) {
    state = stepCarPhysics(state, input, config, dt);
    totalSpeed += speedOf(state);
    totalYaw += Math.abs(state.yawRate ?? 0);
  }

  const averageSpeed = totalSpeed / measureFrames;
  const averageYaw = totalYaw / measureFrames;
  return averageYaw > 1e-6 ? averageSpeed / averageYaw : null;
}

function measureTurning(config: CarPhysicsConfig, dt: number): TurningMetrics {
  return {
    slowRadiusPx: turningRadiusAt(config, config.maxSpeed * 0.25, dt),
    fastRadiusPx: turningRadiusAt(config, config.maxSpeed, dt),
  };
}

function measureDrift(config: CarPhysicsConfig, dt: number): DriftMetrics {
  const frames = Math.round(3 / dt);
  const state = simulate(
    movingState(config.maxSpeed * 0.8),
    { throttle: 1, steer: 1, handbrake: false },
    config,
    frames,
    dt,
  );
  return {
    slipRatio: slipRatioOf(state),
    slipAngleDeg: slipAngleDegOf(state),
    speed: speedOf(state),
  };
}

function measureHandbrake(config: CarPhysicsConfig, dt: number): HandbrakeMetrics {
  const halfSecondFrames = Math.round(0.5 / dt);
  // Se entra en la curva antes de tirar del freno de mano: medir el freno
  // desde recta mide sobre todo la frenada, no el derrape que provoca.
  let state = movingState(config.maxSpeed * 0.8);
  state = simulate(
    state,
    { throttle: 1, steer: 1, handbrake: false },
    config,
    halfSecondFrames,
    dt,
  );

  state = simulate(
    state,
    { throttle: 0, steer: 1, handbrake: true },
    config,
    halfSecondFrames,
    dt,
  );
  const slipRatioAtHalfSecond = slipRatioOf(state);
  const speedAtHalfSecond = speedOf(state);

  // Recuperación: se suelta el freno de mano, se endereza el volante y se
  // mide cuánto tarda el coche en dejar de considerarse en derrape.
  let recoveryTimeSeconds: number | null = null;
  const maxRecoveryFrames = Math.ceil(2 / dt);
  for (let i = 0; i < maxRecoveryFrames; i++) {
    state = stepCarPhysics(state, { throttle: 1, steer: 0, handbrake: false }, config, dt);
    if (slipRatioOf(state) <= 0.35) {
      recoveryTimeSeconds = (i + 1) * dt;
      break;
    }
  }

  return { slipRatioAtHalfSecond, speedAtHalfSecond, recoveryTimeSeconds };
}

/**
 * Circuito sintético para medir la colisión: 10×10 tiles y un muro de 4
 * columnas (128 px) en mitad del recorrido. No depende de los circuitos del
 * juego, así la métrica sigue siendo válida aunque cambie el contenido.
 */
function collisionTestTrack(): TrackDefinition {
  const width = 10;
  const height = 10;
  const walls = Array.from({ length: height }, () =>
    Array.from({ length: width }, (_, col) => (col >= WALL_START_COLUMN && col < WALL_END_COLUMN ? 1 : 0)),
  );
  const surface = Array.from({ length: height }, () => Array.from({ length: width }, () => 'asphalt'));

  return {
    schemaVersion: 1,
    id: 'feel-collision',
    name: 'Feel Collision',
    size: { width: width * WALL_TILE_SIZE, height: height * WALL_TILE_SIZE },
    tileSize: WALL_TILE_SIZE,
    surfaces: { asphalt: { grip: 1, drag: 1 } },
    layers: { surface, walls },
    spawn: { x: 100, y: 176, angle: 0 },
    waypoints: [{ x: 100, y: 176, type: 'start_finish' }],
    laps: 1,
    theme: 'test',
  };
}

function measureWall(config: CarPhysicsConfig, dt: number): WallMetrics {
  const track = collisionTestTrack();
  let state: CarState = { x: 100, y: 176, angle: 0, vx: config.maxSpeed, vy: 0, yawRate: 0 };
  let elapsed = 0;
  const maxFrames = Math.ceil(MAX_SIM_SECONDS / dt);

  for (let i = 0; i < maxFrames; i++) {
    const previous = state;
    state = stepCarPhysics(state, { throttle: 1, steer: 0, handbrake: false }, config, dt);
    state = resolveCarCollision(previous, state, track, {
      length: config.length,
      width: config.width,
    }).state;
    elapsed += dt;

    // El centro del coche no debería pasar nunca del final del muro.
    if (state.x > WALL_END_X) {
      return { crossed: true, timeSeconds: elapsed };
    }
  }

  return { crossed: false, timeSeconds: null };
}

export function measureFeel(config: CarPhysicsConfig, options: FeelOptions = {}): FeelMetrics {
  const hz = options.hz ?? DEFAULT_HZ;
  if (!(hz > 0) || !Number.isFinite(hz)) {
    throw new Error(`measureFeel: hz debe ser un número positivo (recibido ${hz})`);
  }
  const dt = 1 / hz;

  return {
    acceleration: measureAcceleration(config, dt),
    braking: measureBraking(config, dt),
    coasting: measureCoasting(config, dt),
    turning: measureTurning(config, dt),
    drift: measureDrift(config, dt),
    handbrake: measureHandbrake(config, dt),
    wall: measureWall(config, dt),
  };
}

function formatTarget(target: NumericTarget): string {
  return `${target.min}–${target.max} ${target.unit}`;
}

function passesNumericTarget(value: number | null, target: NumericTarget): boolean {
  return value !== null && value >= target.min && value <= target.max;
}

function valueForTarget(metrics: FeelMetrics, id: string): number | null {
  switch (id) {
    case 'accel-90':
      return metrics.acceleration.timeTo90Pct;
    case 'brake-time':
      return metrics.braking.timeSeconds;
    case 'brake-distance':
      return metrics.braking.distancePx;
    case 'coast-1s':
      return metrics.coasting.ratioAfter1s;
    case 'turn-slow':
      return metrics.turning.slowRadiusPx;
    case 'turn-fast':
      return metrics.turning.fastRadiusPx;
    case 'drift':
      return metrics.drift.slipRatio;
    case 'handbrake':
      return metrics.handbrake.slipRatioAtHalfSecond;
    case 'recovery':
      return metrics.handbrake.recoveryTimeSeconds;
    default:
      return null;
  }
}

export function evaluateFeelMetrics(metrics: FeelMetrics): FeelTargetResult[] {
  const numericResults = FEEL_TARGETS.map((target) => {
    const value = valueForTarget(metrics, target.id);
    return {
      id: target.id,
      label: target.label,
      value,
      unit: target.unit,
      targetText: formatTarget(target),
      passes: passesNumericTarget(value, target),
    };
  });

  numericResults.push({
    id: 'wall',
    label: 'Muro de 128 px',
    value: metrics.wall.crossed ? 1 : 0,
    unit: 'sí/no',
    targetText: 'no atravesable',
    passes: !metrics.wall.crossed,
  });

  return numericResults;
}

function formatValue(result: FeelTargetResult): string {
  if (result.id === 'wall') return result.passes ? 'no' : 'sí';
  if (result.value === null) return '—';
  if (result.unit === '×') return result.value.toFixed(2);
  if (result.unit === 's') return `${result.value.toFixed(2)} s`;
  return `${result.value.toFixed(0)} ${result.unit}`;
}

export function formatFeelReport(metrics: FeelMetrics): string {
  const results = evaluateFeelMetrics(metrics);
  const lines: string[] = [];

  lines.push('Feel metrics — Rally 90s');
  lines.push('========================');
  lines.push('');

  for (const result of results) {
    const status = result.passes ? 'PASS' : 'FAIL';
    const value = formatValue(result);
    lines.push(
      `${status.padEnd(4)}  ${result.label.padEnd(34)} ${value.padStart(11)}  (objetivo: ${result.targetText})`,
    );
  }

  const passed = results.filter((result) => result.passes).length;
  lines.push('');
  lines.push(`${passed}/${results.length} métricas dentro del objetivo.`);
  lines.push('');
  lines.push(
    'Nota: los FAIL de conducción son esperados hasta el re-tuning de S1.4. El muro ya usa la colisión real de S1.3.',
  );

  return lines.join('\n');
}
