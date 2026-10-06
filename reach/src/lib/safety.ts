/**
 * transient: Gmail 5xx, request definitely not accepted -> safe to retry.
 * ambiguous: network failure/timeout, Gmail may have accepted the message -> never auto-retry.
 */
export type GmailErrorKind = 'rate_limit' | 'daily_limit' | 'suspicious' | 'auth' | 'transient' | 'ambiguous' | 'other';

export const BOUNCE_THRESHOLD = 0.03;
const USER_MIN_SAMPLE = 50;
const GLOBAL_MIN_SAMPLE = 100;

export interface BounceStats {
  sent: number;
  bounced: number;
}

/** User bounce rate on their last 100 sends; ignored until there are enough sends to be meaningful. */
export const userBounceExceeded = ({ sent, bounced }: BounceStats): boolean =>
  sent >= USER_MIN_SAMPLE && bounced / sent > BOUNCE_THRESHOLD;

export const globalBounceExceeded = ({ sent, bounced }: BounceStats): boolean =>
  sent >= GLOBAL_MIN_SAMPLE && bounced / sent > BOUNCE_THRESHOLD;

interface GmailErrorLike {
  code?: number | string;
  message?: string;
  errors?: { reason?: string }[];
  response?: { data?: { error?: { errors?: { reason?: string }[] } } };
}

export function classifyGmailError(err: GmailErrorLike): GmailErrorKind {
  const reasons = [...(err.errors ?? []), ...(err.response?.data?.error?.errors ?? [])].map((e) => e.reason ?? '');
  const msg = (err.message ?? '').toLowerCase();
  const code = Number(err.code);

  if (/suspicious|unusual activity|reached a limit for sending|sending limit|account.*(disabled|suspended)/.test(msg)) return 'suspicious';
  if (reasons.includes('dailyLimitExceeded') || /daily.*(limit|quota)/.test(msg)) return 'daily_limit';
  if (code === 429 || reasons.some((r) => r === 'rateLimitExceeded' || r === 'userRateLimitExceeded')) return 'rate_limit';
  if (code === 401 || /invalid_grant|invalid credentials/.test(msg)) return 'auth';
  if (code >= 500 && code < 600) return 'transient';
  if (/etimedout|econnreset|econnrefused|enotfound|socket hang up|fetch failed|timed? ?out|network/.test(`${msg} ${String(err.code ?? '').toLowerCase()}`)) {
    return 'ambiguous';
  }
  return 'other';
}

/** Exponential backoff (1s, 2s, 4s...) capped at 60s, plus up to 50% jitter. */
export function backoffMs(attempt: number, rand: () => number = Math.random): number {
  const base = Math.min(60_000, 1000 * 2 ** attempt);
  return base + Math.floor(rand() * base * 0.5);
}
