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

function driveThroughLap(tracker: LapTracker, startElapsedMs: number): number {
  let t = startElapsedMs;
  tracker.update(100, 0, (t += 1000)); // checkpoint 1
  tracker.update(100, 100, (t += 1000)); // checkpoint 2
  tracker.update(0, 100, (t += 1000)); // checkpoint 3
  tracker.update(0, 0, (t += 1000)); // vuelta a meta
  return t;
}

describe('LapTracker', () => {
  it('does not complete a lap by touching the start/finish line without visiting checkpoints', () => {
    const tracker = new LapTracker(waypoints, 3, RADIUS);
    tracker.update(0, 0, 500); // vuelve a tocar la salida sin dar la vuelta
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
    tracker.update(100, 0, (t += 500));
    tracker.update(100, 100, (t += 500));
    tracker.update(0, 100, (t += 500));
    tracker.update(0, 0, (t += 500));

    const state = tracker.getState();
    expect(state.lastLapMs).toBe(2000);
    expect(state.bestLapMs).toBe(2000);
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
    tracker.update(100, 0, 1000); // checkpoint 1
    expect(tracker.nextTargetIndex).toBe(2);
    tracker.update(100, 100, 2000); // checkpoint 2
    expect(tracker.nextTargetIndex).toBe(3);
    tracker.update(0, 100, 3000); // checkpoint 3
    expect(tracker.nextTargetIndex).toBe(0); // ahora toca volver a la meta
    tracker.update(0, 0, 4000); // cruza la meta: nueva vuelta
    expect(tracker.nextTargetIndex).toBe(1);
  });
});
