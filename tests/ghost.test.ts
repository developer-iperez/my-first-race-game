import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GhostRecorder } from '../src/race/GhostRecorder';
import { GhostStore } from '../src/race/GhostStore';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GhostRecorder', () => {
  it('graba a 20 Hz y recorta los decimales', () => {
    const recorder = new GhostRecorder();
    recorder.reset(0);
    recorder.record(0, 1.234, 2.345, 0.1234);
    recorder.record(25, 10, 20, 1);
    recorder.record(50, 20, 30, 2);

    expect(recorder.getSamples()).toEqual([
      [0, 1.2, 2.3, 0.123],
      [50, 20, 30, 2],
    ]);
  });

  it('fuerza la muestra final y se puede descartar con un reset manual', () => {
    const recorder = new GhostRecorder();
    recorder.reset(1000);
    recorder.record(1000, 0, 0, 0);
    recorder.forceSample(1010, 5, 6, 0.5);
    expect(recorder.getSamples()).toHaveLength(2);

    recorder.discard();
    expect(recorder.isValid).toBe(false);
    recorder.record(1020, 10, 10, 1);
    expect(recorder.getSamples()).toHaveLength(0);
  });

  it('no graba más de 90 s', () => {
    const recorder = new GhostRecorder();
    recorder.reset(0);
    recorder.record(90_001, 10, 10, 0);
    expect(recorder.getSamples()).toEqual([]);
  });
});

describe('GhostStore', () => {
  it('guarda y recupera el fantasma por circuito, coche y tuning', () => {
    const ghost = {
      version: 1 as const,
      lapMs: 12_345,
      frames: [[0, 10, 20, 0] as [number, number, number, number]],
    };
    GhostStore.save('track:a', 'car:a', 's0.60-a0.60-g1.00', ghost);

    expect(GhostStore.get('track:a', 'car:a', 's0.60-a0.60-g1.00')).toEqual(ghost);
    expect(GhostStore.get('track:a', 'car:a', 's0.85-a0.60-g1.00')).toBeNull();
  });

  it('ignora fantasmas con formato inválido', () => {
    storage.set('rally90s:ghosts', JSON.stringify({ 'track:a::car:a::x': { version: 2 } }));
    expect(GhostStore.get('track:a', 'car:a', 'x')).toBeNull();
  });

  it('limita el número de fantasmas guardados', () => {
    for (let i = 0; i < 15; i++) {
      GhostStore.save('track:a', 'car:a', `tuning-${i}`, {
        version: 1,
        lapMs: 10_000 + i,
        frames: [[0, 0, 0, 0]],
      });
    }

    const saved = JSON.parse(storage.get('rally90s:ghosts') ?? '{}') as Record<string, unknown>;
    expect(Object.keys(saved)).toHaveLength(12);
    expect(GhostStore.get('track:a', 'car:a', 'tuning-14')).not.toBeNull();
  });
});
