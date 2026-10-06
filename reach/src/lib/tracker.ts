import type { User } from '@prisma/client';
import { bounceLooksAuthentic, isBounceSender, parseBounceRecipient } from './bounce';
import { prisma } from './db';
import { GmailClient } from './gmail';
import { extractText, headerValue } from './gmail-parse';
import { DAY_MS } from './limits';
import { detectOptOut } from './reply';
import { addQuota, enforceProjectQuota } from './settings';

const LOOKBACK_DAYS = 14;
const MAX_CHECKS_PER_USER = 300;
const MAX_INBOX_PAGES = 5;
const BOUNCE_PAGE_SIZE = 100;
const MAX_BOUNCE_PAGES = 5;
const AUTO_REPLY = /out of office|automatic reply|auto[- ]?reply|autoreply|vacation/i;

export interface TrackSummary {
  userId: string;
  replied: number;
  optedOut: number;
  bounced: number;
  note?: string;
}

export async function runTrackTick(now = new Date()): Promise<TrackSummary[] | { skipped: string }> {
  if (await enforceProjectQuota()) return { skipped: 'project_quota' };
  const users = await prisma.user.findMany({
    where: { gmailConnected: true, disabled: false, encryptedRefreshToken: { not: null } },
  });
  return Promise.all(
    users.map((u) =>
      trackUser(u, now).catch((err: unknown): TrackSummary => ({
        userId: u.id,
        replied: 0,
        optedOut: 0,
        bounced: 0,
        note: `error: ${err instanceof Error ? err.message : String(err)}`,
      })),
    ),
  );
}

async function filterUnprocessed(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const done = await prisma.processedMessage.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const seen = new Set(done.map((d) => d.id));
  return new Set(ids.filter((id) => !seen.has(id)));
}

const markProcessed = (userId: string, id: string) =>
  prisma.processedMessage.upsert({ where: { id }, update: {}, create: { id, userId } });

type TrackedContact = { id: string; email: string; gmailThreadId: string | null };

async function trackUser(user: User, now: Date): Promise<TrackSummary> {
  const summary: TrackSummary = { userId: user.id, replied: 0, optedOut: 0, bounced: 0 };
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS);
  const contacts = await prisma.contact.findMany({
    where: { assignedToId: user.id, status: 'SENT', sentAt: { gt: since }, gmailThreadId: { not: null } },
    orderBy: [{ lastCheckedAt: { sort: 'asc', nulls: 'first' } }],
    take: MAX_CHECKS_PER_USER,
  });

  const gmail = GmailClient.forRefreshToken(user.encryptedRefreshToken!);
  const errors: string[] = [];
  const guard = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  try {
    if (contacts.length) await guard('replies', () => trackReplies(user, gmail, contacts, summary, errors));
    await guard('bounces', () => trackBounces(user, gmail, summary, errors));
  } finally {
    // Always advance lastCheckedAt so one poisoned message cannot pin the same 300 contacts forever.
    if (contacts.length) {
      await prisma.contact.updateMany({ where: { id: { in: contacts.map((c) => c.id) } }, data: { lastCheckedAt: now } });
    }
    await addQuota(gmail.units);
  }
  if (errors.length) summary.note = errors.slice(0, 3).join(' | ');
  return summary;
}

/** One cheap listing of recent mail, matched to our sent threads by threadId. Full fetch only for matches. */
async function trackReplies(user: User, gmail: GmailClient, contacts: TrackedContact[], out: TrackSummary, errors: string[]): Promise<void> {
  const byThread = new Map(contacts.map((c) => [c.gmailThreadId!, c]));
  const candidates: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_INBOX_PAGES; page++) {
    const res = await gmail.listMessages(`newer_than:${LOOKBACK_DAYS}d -from:me -in:sent -in:drafts`, 500, pageToken);
    for (const m of res.messages) if (m.id && m.threadId && byThread.has(m.threadId)) candidates.push({ id: m.id, threadId: m.threadId });
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }

  const fresh = await filterUnprocessed(candidates.map((c) => c.id));
  for (const cand of candidates.filter((c) => fresh.has(c.id))) {
    try {
      await handleThreadMessage(user, gmail, cand, byThread.get(cand.threadId)!, out);
      await markProcessed(user.id, cand.id);
    } catch (err) {
      errors.push(`message ${cand.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function handleThreadMessage(
  user: User,
  gmail: GmailClient,
  cand: { id: string },
  contact: TrackedContact,
  out: TrackSummary,
): Promise<void> {
  const msg = await gmail.getMessage(cand.id);
  const from = headerValue(msg.payload, 'From');
  const subject = headerValue(msg.payload, 'Subject');
  const text = extractText(msg.payload);

  if (isBounceSender(from)) {
    // Thread-matched bounce: trust the thread, not any address written in the body.
    if (bounceLooksAuthentic(headerValue(msg.payload, 'Authentication-Results'))) await markBounced(user.id, { id: contact.id }, out);
    return;
  }
  if (headerValue(msg.payload, 'Auto-Submitted').toLowerCase().startsWith('auto') || AUTO_REPLY.test(subject)) return;

  if (detectOptOut(text) || detectOptOut(subject)) {
    const res = await prisma.contact.updateMany({ where: { id: contact.id, status: { in: ['SENT', 'REPLIED'] } }, data: { status: 'OPTED_OUT' } });
    out.optedOut += res.count;
  } else {
    const res = await prisma.contact.updateMany({ where: { id: contact.id, status: 'SENT' }, data: { status: 'REPLIED' } });
    out.replied += res.count;
  }
}

async function markBounced(userId: string, where: { id?: string; email?: string }, out: TrackSummary): Promise<void> {
  const res = await prisma.contact.updateMany({
    where: { ...where, assignedToId: userId, status: { in: ['SENT', 'REPLIED'] } },
    data: { status: 'BOUNCED', errorNote: 'Bounced (mailer-daemon)' },
  });
  out.bounced += res.count;
}

/** Standalone DSNs. Pages until a page has nothing new, so more than 100 bounces in 14 days are still seen. */
async function trackBounces(user: User, gmail: GmailClient, out: TrackSummary, errors: string[]): Promise<void> {
  const q = `from:(mailer-daemon OR postmaster) newer_than:${LOOKBACK_DAYS}d`;
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_BOUNCE_PAGES; page++) {
    const res = await gmail.listMessages(q, BOUNCE_PAGE_SIZE, pageToken);
    const ids = res.messages.flatMap((m) => (m.id ? [m.id] : []));
    const fresh = await filterUnprocessed(ids);
    for (const id of ids.filter((i) => fresh.has(i))) {
      try {
        const msg = await gmail.getMessage(id);
        if (bounceLooksAuthentic(headerValue(msg.payload, 'Authentication-Results'))) {
          const headers = ['X-Failed-Recipients', 'Final-Recipient'].map((h) => `${h}: ${headerValue(msg.payload, h)}`).join('\n');
          const recipient = parseBounceRecipient(`${headers}\n${extractText(msg.payload)}\n${msg.snippet ?? ''}`, user.email);
          if (recipient) await markBounced(user.id, { email: recipient }, out);
        }
        await markProcessed(user.id, id);
      } catch (err) {
        errors.push(`bounce ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    pageToken = res.nextPageToken;
    if (!pageToken || fresh.size === 0) break;
  }
}
