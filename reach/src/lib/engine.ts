import type { Campaign, Contact, User } from '@prisma/client';
import { composeEmail } from './compose';
import { senderOf } from './sender';
import { prisma } from './db';
import { GmailClient, GmailError } from './gmail';
import { DAY_MS, effectiveDailyCap, perMinuteRemaining, remainingToday } from './limits';
import { buildMime, toBase64Url } from './mime';
import { batchSize, inSendWindow, planGaps } from './scheduler';
import { globalBounceExceeded, userBounceExceeded } from './safety';
import {
  acquireLease,
  addQuota,
  allowTestSend,
  bounceBaseline,
  enforceProjectQuota,
  getGlobalPause,
  raiseAlert,
  releaseLease,
  setGlobalPause,
} from './settings';

/** Gaps (25-45s) + Gmail latency must fit inside the 300s function limit. About 8 sends per organizer per tick. */
const TICK_BUDGET_MS = 265_000;
const LEASE_TTL_MS = 290_000;
const STALE_SENDING_MS = 30 * 60_000;
const HOUR_MS = 3_600_000;
const MAX_CONSECUTIVE_ERRORS = 3;
const UNCONFIRMED = 'Send state unconfirmed';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface UserTick {
  userId: string;
  sent: number;
  note?: string;
}
export interface TickSummary {
  skipped?: string;
  users: UserTick[];
}

export async function getCampaign(): Promise<Campaign> {
  return prisma.campaign.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
}

async function pauseUser(user: User, reason: string, until?: Date): Promise<void> {
  await prisma.user.update({
    where: { id: user.id },
    data: { paused: true, pausedReason: reason, pausedUntil: until ?? null, pausedByAdmin: false },
  });
  await raiseAlert('warning', `${user.email} paused: ${reason}`);
}

async function pauseEveryone(reason: string, cause: 'bounce' | 'gmail'): Promise<void> {
  await setGlobalPause(true, reason, cause);
  await raiseAlert('critical', `ALL SENDING PAUSED: ${reason}`);
}

/** Contacts stuck in SENDING (crash mid-send) are never retried: we cannot know if Gmail delivered them. */
async function flagStaleSending(now: Date): Promise<void> {
  await prisma.contact.updateMany({
    where: { status: 'SENDING', updatedAt: { lt: new Date(now.getTime() - STALE_SENDING_MS) } },
    data: { status: 'ERROR', errorNote: `${UNCONFIRMED} (interrupted). Check the Sent folder before retrying.` },
  });
}

async function globalBounceTripped(now: Date): Promise<boolean> {
  const week = new Date(now.getTime() - 7 * DAY_MS);
  const baseline = await bounceBaseline();
  const since = baseline && baseline > week ? baseline : week;
  const [sent, bounced] = await Promise.all([
    prisma.sendLog.count({ where: { result: 'ok', sentAt: { gt: since } } }),
    prisma.contact.count({ where: { status: 'BOUNCED', sentAt: { gt: since } } }),
  ]);
  return globalBounceExceeded({ sent, bounced });
}

export async function runSendTick(now = new Date()): Promise<TickSummary> {
  if (await enforceProjectQuota()) return { skipped: 'project_quota', users: [] };
  if ((await getGlobalPause()).paused) return { skipped: 'global_paused', users: [] };
  if (!(await acquireLease('send', LEASE_TTL_MS))) return { skipped: 'previous_tick_running', users: [] };

  try {
    if (await globalBounceTripped(now)) {
      await pauseEveryone('Total bounce rate above 3% over the last 7 days', 'bounce');
      return { skipped: 'global_bounce', users: [] };
    }
    const campaign = await getCampaign();
    if (!campaign.active) return { skipped: 'campaign_inactive', users: [] };

    await flagStaleSending(now);
    await prisma.user.updateMany({
      where: { paused: true, pausedUntil: { lte: now } },
      data: { paused: false, pausedReason: null, pausedUntil: null },
    });

    const users = await prisma.user.findMany({
      where: {
        gmailConnected: true,
        paused: false,
        disabled: false,
        encryptedRefreshToken: { not: null },
        contacts: { some: { status: 'QUEUED' } },
      },
    });
    const results = await Promise.all(
      users.map((u) =>
        sendForUser(u, campaign, now).catch((err: unknown): UserTick => ({
          userId: u.id,
          sent: 0,
          note: `error: ${err instanceof Error ? err.message : String(err)}`,
        })),
      ),
    );
    return { users: results };
  } finally {
    await releaseLease('send');
  }
}

/** Re-check pause flags and the send window between sends, so a pause or the end of the window takes effect mid-batch. */
async function mayContinue(user: User): Promise<boolean> {
  const [fresh, global] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { paused: true, disabled: true } }),
    getGlobalPause(),
  ]);
  return !!fresh && !fresh.paused && !fresh.disabled && !global.paused && inSendWindow(new Date(), user.timezone);
}

async function userBouncePaused(user: User): Promise<boolean> {
  const last100 = await prisma.sendLog.findMany({
    where: { userId: user.id, result: 'ok', ...(user.bounceCheckSince ? { sentAt: { gt: user.bounceCheckSince } } : {}) },
    orderBy: { sentAt: 'desc' },
    take: 100,
    select: { contactId: true },
  });
  const bounced = last100.length
    ? await prisma.contact.count({ where: { id: { in: last100.map((l) => l.contactId) }, status: 'BOUNCED' } })
    : 0;
  if (!userBounceExceeded({ sent: last100.length, bounced })) return false;
  await pauseUser(user, `Auto-paused: bounce rate above 3% (${bounced} of last ${last100.length} sends)`);
  return true;
}

async function sendForUser(user: User, campaign: Campaign, now: Date): Promise<UserTick> {
  if (!inSendWindow(now, user.timezone)) return { userId: user.id, sent: 0, note: 'outside window' };
  if (await userBouncePaused(user)) return { userId: user.id, sent: 0, note: 'paused: bounce rate' };

  const logs = await prisma.sendLog.findMany({
    where: { userId: user.id, result: 'ok', sentAt: { gt: new Date(now.getTime() - DAY_MS) } },
    select: { sentAt: true },
  });
  const dates = logs.map((l) => l.sentAt);
  const cap = effectiveDailyCap({ dailyCap: user.dailyCap, rampEnabled: user.rampEnabled, firstSendAt: user.firstSendAt, now });
  const [queued, inFlight] = await Promise.all([
    prisma.contact.count({ where: { assignedToId: user.id, status: 'QUEUED' } }),
    prisma.contact.count({ where: { assignedToId: user.id, status: 'SENDING' } }),
  ]);
  const n = batchSize({
    cap,
    remainingDaily: remainingToday(dates, cap, now) - inFlight,
    sentLastHour: dates.filter((d) => now.getTime() - d.getTime() < HOUR_MS).length + inFlight,
    perMinuteRemaining: perMinuteRemaining(dates, now),
    queued,
  });
  if (n === 0) return { userId: user.id, sent: 0, note: 'no allowance' };

  const batch = await prisma.contact.findMany({
    where: { assignedToId: user.id, status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    take: n,
  });
  const gmail = GmailClient.forRefreshToken(user.encryptedRefreshToken!);
  const gaps = planGaps(batch.length, TICK_BUDGET_MS);
  let sent = 0;
  let errors = 0;
  let note: string | undefined;

  try {
    for (let i = 0; i < gaps.length; i++) {
      if (gaps[i]) await sleep(gaps[i]);
      if (i > 0 && !(await mayContinue(user))) {
        note = 'stopped: paused or window closed';
        break;
      }
      const outcome = await sendOne(user, batch[i], campaign, gmail, dates);
      errors = outcome === 'error' ? errors + 1 : 0;
      if (outcome === 'sent') sent++;
      if (outcome === 'stop' || errors >= MAX_CONSECUTIVE_ERRORS) {
        note = 'stopped';
        break;
      }
    }
  } finally {
    await addQuota(gmail.units);
  }
  return { userId: user.id, sent, note };
}

type Outcome = 'sent' | 'skip' | 'stop' | 'error';

export async function sendOne(user: User, contact: Contact, campaign: Campaign, gmail: GmailClient, recent: Date[]): Promise<Outcome> {
  // Idempotency: only one tick can flip QUEUED -> SENDING for a contact.
  const claim = await prisma.contact.updateMany({
    where: { id: contact.id, status: 'QUEUED', assignedToId: user.id },
    data: { status: 'SENDING' },
  });
  if (claim.count === 0) return 'skip';

  if (contact.verification === 'INVALID' || (contact.verification !== 'VALID' && !campaign.allowNonValid)) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { status: contact.verification === 'INVALID' ? 'INVALID' : 'PENDING', errorNote: 'Not verified as valid' },
    });
    return 'skip';
  }

  const email = composeEmail(campaign, contact, senderOf(user));
  const raw = toBase64Url(
    buildMime({ fromName: user.name || user.email, fromEmail: user.email, to: contact.email, subject: email.subject, text: email.text, html: email.html }),
  );

  let res: { id: string; threadId: string };
  try {
    res = await gmail.send(raw);
  } catch (err) {
    return handleSendError(user, contact, err, recent);
  }
  try {
    await recordSent(user, contact, res);
    return 'sent';
  } catch (err) {
    // Email is out but we could not record it. Leave the contact SENDING (never re-sent) and stop.
    process.stderr.write(`recordSent failed for contact ${contact.id}: ${err instanceof Error ? err.message : String(err)}\n`);
    return 'stop';
  }
}

async function recordSent(user: User, contact: Contact, res: { id: string; threadId: string }): Promise<void> {
  const sentAt = new Date();
  const write = () =>
    prisma.$transaction([
      prisma.contact.update({
        where: { id: contact.id },
        data: { status: 'SENT', sentAt, gmailMessageId: res.id, gmailThreadId: res.threadId, errorNote: null },
      }),
      prisma.sendLog.create({ data: { userId: user.id, contactId: contact.id, sentAt, quotaUnits: 100, result: 'ok' } }),
      prisma.user.updateMany({ where: { id: user.id, firstSendAt: null }, data: { firstSendAt: sentAt } }),
    ]);
  try {
    await write();
  } catch {
    // If the first attempt actually committed, do not write a second SendLog row.
    const cur = await prisma.contact.findUnique({ where: { id: contact.id }, select: { status: true } });
    if (cur?.status === 'SENT') return;
    await write();
  }
}

async function handleSendError(user: User, contact: Contact, err: unknown, recent: Date[]): Promise<Outcome> {
  const kind = err instanceof GmailError ? err.kind : 'other';
  const message = err instanceof Error ? err.message : String(err);
  const requeue = () => prisma.contact.update({ where: { id: contact.id }, data: { status: 'QUEUED' } });

  switch (kind) {
    case 'rate_limit':
      await requeue();
      await pauseUser(user, 'Gmail rate limit; paused 1 hour', new Date(Date.now() + HOUR_MS));
      return 'stop';
    case 'daily_limit': {
      await requeue();
      const oldest = recent.length ? Math.min(...recent.map((d) => d.getTime())) : Date.now();
      await pauseUser(user, 'Gmail daily limit reached', new Date(Math.max(oldest + DAY_MS, Date.now() + HOUR_MS)));
      return 'stop';
    }
    case 'suspicious':
      await requeue();
      await pauseEveryone(`Gmail flagged ${user.email}: ${message}`, 'gmail');
      return 'stop';
    case 'auth':
      await requeue();
      await prisma.user.update({ where: { id: user.id }, data: { gmailConnected: false } });
      await pauseUser(user, 'gmail auth expired');
      return 'stop';
    case 'transient': // Gmail 5xx: not accepted, retry next tick
      await requeue();
      return 'stop';
    case 'ambiguous': // network failure: Gmail may have accepted it, so never auto-retry
      await prisma.contact.update({
        where: { id: contact.id },
        data: { status: 'ERROR', errorNote: `${UNCONFIRMED} (network error: ${message.slice(0, 150)}). Check the Sent folder.` },
      });
      return 'stop';
    default:
      await prisma.$transaction([
        prisma.contact.update({ where: { id: contact.id }, data: { status: 'ERROR', errorNote: message.slice(0, 500) } }),
        prisma.sendLog.create({ data: { userId: user.id, contactId: contact.id, quotaUnits: 100, result: `error: ${message.slice(0, 200)}` } }),
      ]);
      return 'error';
  }
}

/** "Start sending": queue this organizer's pending contacts and clear their own (not admin/safety) pause. */
export async function startSending(user: User): Promise<{ queued: number }> {
  const campaign = await getCampaign();
  const verificationFilter = campaign.allowNonValid ? { not: 'INVALID' as const } : ('VALID' as const);
  const res = await prisma.contact.updateMany({
    where: { assignedToId: user.id, status: 'PENDING', verification: verificationFilter },
    data: { status: 'QUEUED' },
  });
  if (user.paused && user.pausedReason === 'manual' && !user.pausedByAdmin) {
    await prisma.user.update({ where: { id: user.id }, data: { paused: false, pausedReason: null, pausedUntil: null } });
  }
  return { queued: res.count };
}

/** Send a one-off preview to the organizer's own address. Not logged as outreach; counts toward quota. */
export async function sendTestEmail(user: User): Promise<void> {
  if (!user.encryptedRefreshToken) throw new GmailError('auth', 'Gmail is not connected');
  if ((await getGlobalPause()).paused) throw new GmailError('other', 'All sending is paused by an admin');
  if (!(await allowTestSend(user.id))) throw new GmailError('rate_limit', 'Test limit reached (5 per hour)');

  const campaign = await getCampaign();
  const sample = await prisma.contact.findFirst({ where: { assignedToId: user.id }, orderBy: { createdAt: 'asc' } });
  const email = composeEmail(campaign, sample ?? { name: 'Jane Smith', uni: 'Example University' }, senderOf(user));
  const raw = toBase64Url(
    buildMime({
      fromName: user.name || user.email,
      fromEmail: user.email,
      to: user.email,
      subject: `[TEST] ${email.subject}`,
      text: email.text,
      html: email.html,
    }),
  );
  const gmail = GmailClient.forRefreshToken(user.encryptedRefreshToken);
  try {
    await gmail.send(raw);
  } finally {
    await addQuota(gmail.units);
  }
}
