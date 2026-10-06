import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  HARD_MAX_DAILY,
  QUOTA_COST,
  effectiveDailyCap,
  perMinuteRemaining,
  projectQuotaExceeded,
  remainingToday,
} from './limits';

const now = new Date('2026-03-10T15:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('effectiveDailyCap', () => {
  it('uses configured cap, clamped to hard max', () => {
    expect(effectiveDailyCap({ dailyCap: 1000, rampEnabled: false, firstSendAt: null, now })).toBe(1000);
    expect(effectiveDailyCap({ dailyCap: 5000, rampEnabled: false, firstSendAt: null, now })).toBe(HARD_MAX_DAILY);
    expect(effectiveDailyCap({ dailyCap: -5, rampEnabled: false, firstSendAt: null, now })).toBe(0);
  });
  it('ramp: day 1 = 300, day 2+ = full', () => {
    expect(effectiveDailyCap({ dailyCap: 1000, rampEnabled: true, firstSendAt: null, now })).toBe(300);
    expect(effectiveDailyCap({ dailyCap: 1000, rampEnabled: true, firstSendAt: ago(3600_000), now })).toBe(300);
    expect(effectiveDailyCap({ dailyCap: 1000, rampEnabled: true, firstSendAt: ago(DAY_MS + 1), now })).toBe(1000);
  });
  it('ramp never exceeds a smaller configured cap', () => {
    expect(effectiveDailyCap({ dailyCap: 100, rampEnabled: true, firstSendAt: null, now })).toBe(100);
  });
});

describe('remainingToday (rolling 24h)', () => {
  it('counts only sends inside 24h', () => {
    const sends = [ago(1000), ago(DAY_MS - 1000), ago(DAY_MS + 1000), ago(DAY_MS * 2)];
    expect(remainingToday(sends, 10, now)).toBe(8);
  });
  it('never negative', () => {
    expect(remainingToday([ago(1), ago(2), ago(3)], 2, now)).toBe(0);
  });
});

describe('perMinuteRemaining', () => {
  it('limits to 30 per minute', () => {
    const sends = Array.from({ length: 10 }, (_, i) => ago(i * 1000));
    expect(perMinuteRemaining(sends, now)).toBe(20);
    expect(perMinuteRemaining([ago(61_000)], now)).toBe(30);
  });
});

describe('quota', () => {
  it('has documented unit costs', () => {
    expect(QUOTA_COST).toMatchObject({ send: 100, threadsGet: 40, messagesGet: 20, messagesList: 5, historyList: 2 });
  });
  it('trips at 40M units', () => {
    expect(projectQuotaExceeded(39_999_999)).toBe(false);
    expect(projectQuotaExceeded(40_000_000)).toBe(true);
  });
});
