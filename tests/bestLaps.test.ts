import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BestLaps } from '../src/race/BestLaps';

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

describe('BestLaps', () => {
  it('guarda récords separados por tuning', () => {
    BestLaps.reportLap('track:a', 'car:a', 12_000, 'slow');
    BestLaps.reportLap('track:a', 'car:a', 10_000, 'fast');

    expect(BestLaps.get('track:a', 'car:a', 'slow')).toBe(12_000);
    expect(BestLaps.get('track:a', 'car:a', 'fast')).toBe(10_000);
  });

  it('solo guarda si mejora el récord del mismo tuning', () => {
    BestLaps.reportLap('track:a', 'car:a', 10_000, 'x');
    BestLaps.reportLap('track:a', 'car:a', 12_000, 'x');
    expect(BestLaps.get('track:a', 'car:a', 'x')).toBe(10_000);
  });

  it('no mezcla récords antiguos sin tuning con los nuevos', () => {
    storage.set('rally90s:bestLaps', JSON.stringify({ 'track:a::car:a': 9_000 }));
    expect(BestLaps.get('track:a', 'car:a', 'nuevo')).toBeNull();
  });
});
