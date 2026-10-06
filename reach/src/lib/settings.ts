import { prisma } from './db';
import { projectQuotaExceeded } from './limits';

/** Gmail's project quota resets at Pacific midnight, so the counter is keyed by Pacific date. */
const todayKey = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

export type PauseCause = 'quota' | 'bounce' | 'gmail' | 'manual';

const upsertSetting = (key: string, value: string) =>
  prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });

export async function getSetting(key: string): Promise<string | null> {
  return (await prisma.setting.findUnique({ where: { key } }))?.value ?? null;
}

export async function getGlobalPause(): Promise<{ paused: boolean; reason: string; cause: PauseCause | null }> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ['globalPaused', 'globalPausedReason', 'globalPausedCause'] } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    paused: map.get('globalPaused') === 'true',
    reason: map.get('globalPausedReason') ?? '',
    cause: (map.get('globalPausedCause') as PauseCause | undefined) ?? null,
  };
}

export async function setGlobalPause(paused: boolean, reason = '', cause: PauseCause = 'manual'): Promise<void> {
  await prisma.$transaction([
    upsertSetting('globalPaused', String(paused)),
    upsertSetting('globalPausedReason', reason),
    upsertSetting('globalPausedCause', paused ? cause : ''),
  ]);
}

/** Admin resume: bounce counting restarts from now so old bounces cannot instantly re-trip the pause. */
export async function resumeAll(now = new Date()): Promise<void> {
  await prisma.$transaction([
    upsertSetting('globalPaused', 'false'),
    upsertSetting('globalPausedReason', ''),
    upsertSetting('globalPausedCause', ''),
    upsertSetting('bounceBaseline', String(now.getTime())),
  ]);
}

export async function bounceBaseline(): Promise<Date | null> {
  const v = await getSetting('bounceBaseline');
  return v ? new Date(Number(v)) : null;
}

export async function raiseAlert(level: 'warning' | 'critical', message: string): Promise<void> {
  await prisma.alert.create({ data: { level, message } });
}

export async function addQuota(units: number): Promise<void> {
  if (units <= 0) return;
  await prisma.quotaUsage.upsert({
    where: { date: todayKey() },
    update: { units: { increment: units } },
    create: { date: todayKey(), units },
  });
}

export async function quotaToday(): Promise<number> {
  return (await prisma.quotaUsage.findUnique({ where: { date: todayKey() } }))?.units ?? 0;
}

/**
 * Pause everything when estimated project quota is nearly spent; lift a quota-caused pause
 * automatically once the new quota day starts. Returns true while the guard is active.
 */
export async function enforceProjectQuota(): Promise<boolean> {
  const units = await quotaToday();
  const pause = await getGlobalPause();
  if (projectQuotaExceeded(units)) {
    if (!pause.paused) {
      await setGlobalPause(true, `Estimated Gmail quota reached ${units.toLocaleString()} units today`, 'quota');
      await raiseAlert('critical', `Project quota guard tripped at ${units.toLocaleString()} units. All sending paused.`);
    }
    return true;
  }
  if (pause.paused && pause.cause === 'quota') await setGlobalPause(false);
  return false;
}

/** At most `max` test emails per user per hour (a rolling list of timestamps in Setting). */
export async function allowTestSend(userId: string, now = new Date(), max = 5): Promise<boolean> {
  const key = `testSends:${userId}`;
  const recent = (await getSetting(key))?.split(',').map(Number).filter((t) => now.getTime() - t < 3_600_000) ?? [];
  if (recent.length >= max) return false;
  await upsertSetting(key, [...recent, now.getTime()].join(','));
  return true;
}

/** Lease so overlapping cron calls cannot run two send ticks at once. Returns true if acquired. */
export async function acquireLease(name: string, ttlMs: number, now = Date.now()): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO "Setting" ("key", "value") VALUES (${`lease:${name}`}, ${String(now + ttlMs)})
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
    WHERE ("Setting"."value")::bigint < ${now}::bigint
    RETURNING "key"`;
  return rows.length > 0;
}

export const releaseLease = (name: string) => upsertSetting(`lease:${name}`, '0');
