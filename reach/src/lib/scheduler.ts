const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 18;
const WINDOW_HOURS = WINDOW_END_HOUR - WINDOW_START_HOUR;
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

/** True between 8:00 and 17:59 in the organizer's local time. */
export function inSendWindow(now: Date, timeZone: string): boolean {
  const h = localHour(now, timeZone);
  return h >= WINDOW_START_HOUR && h < WINDOW_END_HOUR;
}

/** Random 25-45s gap between sends. */
export function gapMs(rand: () => number = Math.random): number {
  return 25_000 + Math.floor(rand() * 20_001);
}

export interface BatchInput {
  cap: number;
  remainingDaily: number;
  sentLastHour: number;
  perMinuteRemaining: number;
  queued: number;
}

/** How many emails one organizer may send this tick, spreading the daily cap across the window (~cap/10 per hour). */
export function batchSize(i: BatchInput): number {
  if (i.cap <= 0) return 0;
  const hourlyTarget = Math.ceil(i.cap / WINDOW_HOURS);
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
