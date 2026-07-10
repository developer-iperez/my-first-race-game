import { describe, expect, it } from 'vitest';
import { formatLapTime } from '../src/race/formatTime';

describe('formatLapTime', () => {
  it('formats zero as 00:00.000', () => {
    expect(formatLapTime(0)).toBe('00:00.000');
  });

  it('formats sub-minute times', () => {
    expect(formatLapTime(45231)).toBe('00:45.231');
  });

  it('formats times over a minute', () => {
    expect(formatLapTime(75000)).toBe('01:15.000');
  });

  it('pads milliseconds to 3 digits', () => {
    expect(formatLapTime(1005)).toBe('00:01.005');
  });

  it('returns a placeholder for negative or non-finite values', () => {
    expect(formatLapTime(-1)).toBe('--:--.---');
    expect(formatLapTime(NaN)).toBe('--:--.---');
    expect(formatLapTime(Infinity)).toBe('--:--.---');
  });
});
