import { describe, expect, it } from 'vitest';
import { LapTracker } from '../src/race/LapTracker';
import type { Waypoint } from '../src/config/schema/track';

const waypoints: Waypoint[] = [
  { x: 0, y: 0, type: 'start_finish' },
  { x: 100, y: 0, type: 'checkpoint' },
  { x: 100, y: 100, type: 'checkpoint' },
  { x: 0, y: 100, type: 'checkpoint' },
];

const RADIUS = 5;
const SPEED = 50;

// Direcciones esperadas de cada tramo (de un waypoint al siguiente): +x, +y, -x, -y.
function driveThroughLap(tracker: LapTracker, startElapsedMs: number): number {
  let t = startElapsedMs;
  tracker.update(100, 0, SPEED, 0, (t += 1000)); // checkpoint 1 (+x)
  tracker.update(100, 100, 0, SPEED, (t += 1000)); // checkpoint 2 (+y)
  tracker.update(0, 100, -SPEED, 0, (t += 1000)); // checkpoint 3 (-x)
  tracker.update(0, 0, 0, -SPEED, (t += 1000)); // vuelta a meta (-y)
  return t;
}

describe('LapTracker', () => {
  it('does not complete a lap by touching the start/finish line without visiting checkpoints', () => {
    const tracker = new LapTracker(waypoints, 3, RADIUS);
    tracker.update(0, 0, 0, -SPEED, 500); // vuelve a tocar la salida sin dar la vuelta
    expect(tracker.getState().lastLapMs).toBeNull();
  });

  it('completes a lap after visiting every checkpoint in order and returning to start/finish', () => {
    const tracker = new LapTracker(waypoints, 3, RADIUS);
    driveThroughLap(tracker, 0);
    const state = tracker.getState();
    expect(state.lastLapMs).toBe(4000);
    expect(state.bestLapMs).toBe(4000);
    expect(state.currentLap).toBe(2);
    expect(state.finished).toBe(false);
  });

  it('tracks the best lap across multiple laps', () => {
    const tracker = new LapTracker(waypoints, 3, RADIUS);
    let t = driveThroughLap(tracker, 0); // vuelta 1: 4000ms
    // vuelta 2, más rápida (500ms por tramo -> 2000ms)
    tracker.update(100, 0, SPEED, 0, (t += 500));
    tracker.update(100, 100, 0, SPEED, (t += 500));
    tracker.update(0, 100, -SPEED, 0, (t += 500));
    tracker.update(0, 0, 0, -SPEED, (t += 500));

    const state = tracker.getState();
    expect(state.lastLapMs).toBe(2000);
    expect(state.bestLapMs).toBe(2000);
  });

  describe('vuelta previa (guardada entre sesiones, ver BestLaps)', () => {
    it('reports the seeded best lap from the very first frame, before completing any lap', () => {
      const tracker = new LapTracker(waypoints, 3, RADIUS, 3500);
      expect(tracker.getState().bestLapMs).toBe(3500);
      expect(tracker.getState().lastLapMs).toBeNull();
    });

    it('keeps the seeded best lap when a new lap is slower', () => {
      const tracker = new LapTracker(waypoints, 3, RADIUS, 3500);
      driveThroughLap(tracker, 0); // vuelta 1: 4000ms, más lenta que el récord guardado
      const state = tracker.getState();
      expect(state.lastLapMs).toBe(4000);
      expect(state.bestLapMs).toBe(3500);
    });

    it('replaces the seeded best lap when a new lap beats it', () => {
      const tracker = new LapTracker(waypoints, 3, RADIUS, 3500);
      let t = 0;
      // vuelta rápida: 500ms por tramo -> 2000ms, mejor que el récord guardado
      tracker.update(100, 0, SPEED, 0, (t += 500));
      tracker.update(100, 100, 0, SPEED, (t += 500));
      tracker.update(0, 100, -SPEED, 0, (t += 500));
      tracker.update(0, 0, 0, -SPEED, (t += 500));
      const state = tracker.getState();
      expect(state.lastLapMs).toBe(2000);
      expect(state.bestLapMs).toBe(2000);
    });

    it('with no seed, behaves exactly as before (bestLapMs starts null)', () => {
      const tracker = new LapTracker(waypoints, 3, RADIUS);
      expect(tracker.getState().bestLapMs).toBeNull();
    });
  });

  it('finishes the race after completing totalLaps laps', () => {
    const tracker = new LapTracker(waypoints, 2, RADIUS);
    let t = driveThroughLap(tracker, 0);
    expect(tracker.getState().finished).toBe(false);
    driveThroughLap(tracker, t);
    expect(tracker.getState().finished).toBe(true);
  });

  it('stops advancing once finished', () => {
    const tracker = new LapTracker(waypoints, 1, RADIUS);
    driveThroughLap(tracker, 0);
    expect(tracker.getState().finished).toBe(true);
    const stateAfterFinish = tracker.getState();
    // Seguir "conduciendo" no debe registrar más vueltas.
    driveThroughLap(tracker, 100000);
    expect(tracker.getState()).toEqual(stateAfterFinish);
  });

  it('resets currentLapStartMs when a lap completes', () => {
    const tracker = new LapTracker(waypoints, 3, RADIUS);
    expect(tracker.currentLapStartMs).toBe(0);
    const t = driveThroughLap(tracker, 0);
    expect(tracker.currentLapStartMs).toBe(t);
  });

  it('never reports currentLap greater than totalLaps', () => {
    const tracker = new LapTracker(waypoints, 1, RADIUS);
    driveThroughLap(tracker, 0);
    expect(tracker.getState().currentLap).toBe(1);
  });

  it('exposes the index of the next waypoint to reach, advancing as checkpoints are hit', () => {
    const tracker = new LapTracker(waypoints, 3, RADIUS);
    expect(tracker.nextTargetIndex).toBe(1);
    tracker.update(100, 0, SPEED, 0, 1000); // checkpoint 1
    expect(tracker.nextTargetIndex).toBe(2);
    tracker.update(100, 100, 0, SPEED, 2000); // checkpoint 2
    expect(tracker.nextTargetIndex).toBe(3);
    tracker.update(0, 100, -SPEED, 0, 3000); // checkpoint 3
    expect(tracker.nextTargetIndex).toBe(0); // ahora toca volver a la meta
    tracker.update(0, 0, 0, -SPEED, 4000); // cruza la meta: nueva vuelta
    expect(tracker.nextTargetIndex).toBe(1);
  });

  describe('dirección de cruce (bug: ir marcha atrás no debe contar)', () => {
    it('does not advance the target when reaching it with velocity opposite the expected direction', () => {
      const tracker = new LapTracker(waypoints, 3, RADIUS);
      // Objetivo es checkpoint 1 (100,0), dirección esperada +x; llega con velocidad -x (marcha atrás).
      tracker.update(100, 0, -SPEED, 0, 1000);
      expect(tracker.nextTargetIndex).toBe(1); // sigue esperando el mismo checkpoint
      expect(tracker.getState().lastLapMs).toBeNull();
    });

    it('does count reaching a checkpoint once velocity aligns with the expected direction', () => {
      const tracker = new LapTracker(waypoints, 3, RADIUS);
      tracker.update(100, 0, -SPEED, 0, 1000); // marcha atrás: rechazado
      expect(tracker.nextTargetIndex).toBe(1);
      tracker.update(100, 0, SPEED, 0, 1200); // ahora en sentido correcto: cuenta
      expect(tracker.nextTargetIndex).toBe(2);
    });

    it('ignores direction at near-zero speed (coasting into a checkpoint still counts)', () => {
      const tracker = new LapTracker(waypoints, 3, RADIUS);
      // Velocidad mínima, aunque el signo apunte "al revés" no debe rechazarse.
      tracker.update(100, 0, -1, 0, 1000);
      expect(tracker.nextTargetIndex).toBe(2);
    });

    it('driving the whole track backwards never completes a lap', () => {
      const tracker = new LapTracker(waypoints, 3, RADIUS);
      // Intenta "la vuelta" en sentido contrario: da igual que toque los puntos,
      // la velocidad en cada uno apunta siempre al revés de lo esperado.
      let t = 0;
      tracker.update(100, 0, -SPEED, 0, (t += 1000)); // rechazado (esperaba +x)
      tracker.update(100, 100, 0, SPEED, (t += 1000)); // no es el objetivo actual (sigue siendo cp1)
      tracker.update(0, 100, -SPEED, 0, (t += 1000)); // tampoco
      tracker.update(0, 0, 0, -SPEED, (t += 1000)); // tampoco

      const state = tracker.getState();
      expect(state.lastLapMs).toBeNull();
      expect(state.currentLap).toBe(1);
      expect(tracker.nextTargetIndex).toBe(1);
    });
  });
});
