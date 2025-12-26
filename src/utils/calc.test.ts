import { describe, it, expect } from 'vitest';
import { computeCPM } from './calc';

describe('computeCPM', () => {
  it('basic calculation without items', () => {
    const r = computeCPM({ time: '01:00', coins: 1000 });
    expect(r).toBeCloseTo(1000);
  });

  it('applies coin checkbox logic (subtract then 1.3x)', () => {
    const r = computeCPM({ time: '01:00', coins: 1000, items: { coin: true } });
    // lastCoins = 1000 - 500 = 500; then 500 * 1.3 / 1 => 650
    expect(r).toBeCloseTo(650);
  });

  it('handles multiple items', () => {
    const r = computeCPM({ time: '02:00', coins: 5000, items: { score:true, timeItem:true } });
    // lastCoins = 5000 - 500 - 1000 = 3500; totalMinutes = 2 => 1750
    expect(r).toBeCloseTo(1750);
  });

  it('returns NaN for invalid time', () => {
    expect(Number.isNaN(computeCPM({ time: 'aa:bb', coins: 1000 }))).toBe(true);
  });

  it('returns NaN for zero total minutes', () => {
    expect(Number.isNaN(computeCPM({ time: '00:00', coins: 1000 }))).toBe(true);
  });

  it('handles negative coins', () => {
    const r = computeCPM({ time: '01:00', coins: -1000 });
    expect(r).toBeCloseTo(-1000);
  });
});
