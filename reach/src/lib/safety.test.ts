import { describe, expect, it } from 'vitest';
import { backoffMs, classifyGmailError, globalBounceExceeded, userBounceExceeded } from './safety';

describe('userBounceExceeded', () => {
  it('is false with too small a sample', () => {
    expect(userBounceExceeded({ sent: 5, bounced: 3 })).toBe(false);
    expect(userBounceExceeded({ sent: 49, bounced: 5 })).toBe(false);
  });
  it('trips above 3% of last 100', () => {
    expect(userBounceExceeded({ sent: 100, bounced: 4 })).toBe(true);
    expect(userBounceExceeded({ sent: 100, bounced: 3 })).toBe(false);
  });
});

describe('globalBounceExceeded', () => {
  it('trips above 3% overall (needs sample)', () => {
    expect(globalBounceExceeded({ sent: 1000, bounced: 31 })).toBe(true);
    expect(globalBounceExceeded({ sent: 1000, bounced: 30 })).toBe(false);
    expect(globalBounceExceeded({ sent: 10, bounced: 5 })).toBe(false);
  });
});

describe('classifyGmailError', () => {
  it('maps codes and reasons', () => {
    expect(classifyGmailError({ code: 429, message: 'Too many requests' })).toBe('rate_limit');
    expect(classifyGmailError({ code: 403, errors: [{ reason: 'userRateLimitExceeded' }] })).toBe('rate_limit');
    expect(classifyGmailError({ code: 403, errors: [{ reason: 'rateLimitExceeded' }] })).toBe('rate_limit');
    expect(classifyGmailError({ code: 403, errors: [{ reason: 'dailyLimitExceeded' }] })).toBe('daily_limit');
    expect(classifyGmailError({ code: 403, message: 'Suspicious activity detected' })).toBe('suspicious');
    expect(classifyGmailError({ message: 'You have reached a limit for sending mail' })).toBe('suspicious');
    expect(classifyGmailError({ code: 401, message: 'invalid_grant' })).toBe('auth');
    expect(classifyGmailError({ code: 503 })).toBe('transient');
    expect(classifyGmailError({ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' })).toBe('ambiguous');
    expect(classifyGmailError({ code: 400, message: 'Invalid To header' })).toBe('other');
  });
});

describe('backoffMs', () => {
  it('grows exponentially with jitter and caps', () => {
    expect(backoffMs(0, () => 0)).toBe(1000);
    expect(backoffMs(2, () => 0)).toBe(4000);
    expect(backoffMs(1, () => 0.5)).toBeGreaterThan(2000);
    expect(backoffMs(20, () => 0.99)).toBeLessThanOrEqual(60_000 * 1.5);
  });
});
