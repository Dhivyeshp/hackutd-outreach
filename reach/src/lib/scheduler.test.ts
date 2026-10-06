import { describe, expect, it } from 'vitest';
import { batchSize, gapMs, inSendWindow, planGaps } from './scheduler';

describe('inSendWindow', () => {
  it('is 8am-7pm in the organizer timezone', () => {
    // 15:00Z = 9am CST(-6)? In March 10 2026 Dallas is CDT(-5) => 10:00
    expect(inSendWindow(new Date('2026-03-10T15:00:00Z'), 'America/Chicago')).toBe(true);
    expect(inSendWindow(new Date('2026-03-10T12:59:00Z'), 'America/Chicago')).toBe(false); // 7:59
    expect(inSendWindow(new Date('2026-03-10T13:00:00Z'), 'America/Chicago')).toBe(true); // 8:00
    expect(inSendWindow(new Date('2026-03-10T23:59:00Z'), 'America/Chicago')).toBe(true); // 18:59
    expect(inSendWindow(new Date('2026-03-11T00:00:00Z'), 'America/Chicago')).toBe(false); // 19:00
  });
  it('falls back to Chicago on a bad timezone', () => {
    expect(inSendWindow(new Date('2026-03-10T15:00:00Z'), 'Not/AZone')).toBe(true);
  });
});

describe('gapMs', () => {
  it('is within 12-25s', () => {
    expect(gapMs(() => 0)).toBe(12_000);
    expect(gapMs(() => 0.999999)).toBeLessThanOrEqual(25_000);
    for (let i = 0; i < 100; i++) {
      const g = gapMs();
      expect(g).toBeGreaterThanOrEqual(12_000);
      expect(g).toBeLessThanOrEqual(25_000);
    }
  });
});

describe('batchSize', () => {
  const base = { cap: 1000, remainingDaily: 1000, sentLastHour: 0, perMinuteRemaining: 30, queued: 500 };
  it('paces ~167/hr in 5 min ticks (about 14)', () => {
    const n = batchSize(base);
    expect(n).toBeGreaterThanOrEqual(13);
    expect(n).toBeLessThanOrEqual(15);
  });
  it('stops when the hourly budget is used', () => {
    expect(batchSize({ ...base, sentLastHour: 167 })).toBe(0);
    expect(batchSize({ ...base, sentLastHour: 164 })).toBe(3);
  });
  it('respects queue, daily remaining, per-minute', () => {
    expect(batchSize({ ...base, queued: 2 })).toBe(2);
    expect(batchSize({ ...base, remainingDaily: 1 })).toBe(1);
    expect(batchSize({ ...base, perMinuteRemaining: 0 })).toBe(0);
  });
  it('is zero for zero cap', () => {
    expect(batchSize({ ...base, cap: 0 })).toBe(0);
  });
});

describe('planGaps', () => {
  it('stops adding sends once the time budget is exhausted', () => {
    const gaps = planGaps(20, 100_000, () => 0);
    expect(gaps.length).toBeLessThan(20);
    expect(gaps.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(100_000);
  });
});
