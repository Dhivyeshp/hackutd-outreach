export const DAY_MS = 24 * 60 * 60 * 1000;
export const HARD_MAX_DAILY = 1500;
export const DEFAULT_DAILY_CAP = 1000;
export const RAMP_DAY1_CAP = 300;
export const MAX_PER_MINUTE = 30;
export const PROJECT_QUOTA_PAUSE_UNITS = 40_000_000;

/** Gmail API quota units per call. */
export const QUOTA_COST = { send: 100, threadsGet: 40, messagesGet: 20, messagesList: 5, historyList: 2 } as const;

export interface CapInput {
  dailyCap: number;
  rampEnabled: boolean;
  firstSendAt: Date | null;
  now: Date;
}

export function effectiveDailyCap({ dailyCap, rampEnabled, firstSendAt, now }: CapInput): number {
  const cap = Math.min(Math.max(Math.floor(dailyCap), 0), HARD_MAX_DAILY);
  const onDayOne = !firstSendAt || now.getTime() - firstSendAt.getTime() < DAY_MS;
  return rampEnabled && onDayOne ? Math.min(cap, RAMP_DAY1_CAP) : cap;
}

const within = (sent: Date, now: Date, windowMs: number) => {
  const age = now.getTime() - sent.getTime();
  return age >= 0 && age < windowMs;
};

export function remainingToday(sends: readonly Date[], cap: number, now: Date): number {
  return Math.max(cap - sends.filter((s) => within(s, now, DAY_MS)).length, 0);
}

export function perMinuteRemaining(sends: readonly Date[], now: Date): number {
  return Math.max(MAX_PER_MINUTE - sends.filter((s) => within(s, now, 60_000)).length, 0);
}

export const projectQuotaExceeded = (unitsToday: number) => unitsToday >= PROJECT_QUOTA_PAUSE_UNITS;
