const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 19;
/** Each organizer sends at most this many emails an hour (the daily cap still applies on top). */
export const HOURLY_TARGET = 200;
// 17 sends per 5-minute run need 16 gaps, which at 8-16s fits well inside the 265s tick budget.
export const GAP_MIN_MS = 8_000;
export const GAP_MAX_MS = 16_000;
const TICKS_PER_HOUR = 12; // cron every 5 minutes
export const DEFAULT_TZ = 'America/Chicago';

function localHour(now: Date, timeZone: string): number {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  let parts;
  try {
    parts = fmt(timeZone);
  } catch {
    parts = fmt(DEFAULT_TZ);
  }
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
}

/** True between 8:00 and 18:59 in the organizer's local time. */
export function inSendWindow(now: Date, timeZone: string): boolean {
  const h = localHour(now, timeZone);
  return h >= WINDOW_START_HOUR && h < WINDOW_END_HOUR;
}

/** Random 8-16s gap between sends. */
export function gapMs(rand: () => number = Math.random): number {
  return GAP_MIN_MS + Math.floor(rand() * (GAP_MAX_MS - GAP_MIN_MS + 1));
}

export interface BatchInput {
  cap: number;
  remainingDaily: number;
  sentLastHour: number;
  perMinuteRemaining: number;
  queued: number;
}

/** How many emails one organizer may send this tick, at up to HOURLY_TARGET per hour (200). */
export function batchSize(i: BatchInput): number {
  if (i.cap <= 0) return 0;
  const hourlyTarget = Math.min(HOURLY_TARGET, i.cap);
  const perTick = Math.ceil(hourlyTarget / TICKS_PER_HOUR);
  const n = Math.min(perTick, hourlyTarget - i.sentLastHour, i.remainingDaily, i.perMinuteRemaining, i.queued);
  return Math.max(n, 0);
}

/** Delays before each send in a tick; stops once the serverless time budget is used up. */
export function planGaps(count: number, budgetMs: number, rand: () => number = Math.random): number[] {
  const gaps: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const g = i === 0 ? 0 : gapMs(rand);
    if (total + g > budgetMs) break;
    total += g;
    gaps.push(g);
  }
  return gaps;
}
