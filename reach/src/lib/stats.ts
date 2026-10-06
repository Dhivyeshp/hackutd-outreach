import type { ContactStatus, User } from '@prisma/client';
import { prisma } from './db';
import { DAY_MS, effectiveDailyCap, remainingToday } from './limits';

export interface OrganizerStats {
  userId: string;
  assigned: number;
  pending: number;
  queued: number;
  sent: number;
  replied: number;
  bounced: number;
  optedOut: number;
  errors: number;
  sentLast24h: number;
  bounceRate: number;
}

const SENT_STATUSES: ContactStatus[] = ['SENT', 'REPLIED', 'BOUNCED', 'OPTED_OUT'];

function blank(userId: string): OrganizerStats {
  return { userId, assigned: 0, pending: 0, queued: 0, sent: 0, replied: 0, bounced: 0, optedOut: 0, errors: 0, sentLast24h: 0, bounceRate: 0 };
}

/** Stats for every organizer in two grouped queries (no N+1). */
export async function allOrganizerStats(userIds: string[], now = new Date()): Promise<Map<string, OrganizerStats>> {
  const [byStatus, last24] = await Promise.all([
    prisma.contact.groupBy({ by: ['assignedToId', 'status'], where: { assignedToId: { in: userIds } }, _count: { _all: true } }),
    prisma.sendLog.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, result: 'ok', sentAt: { gt: new Date(now.getTime() - DAY_MS) } },
      _count: { _all: true },
    }),
  ]);
  const map = new Map(userIds.map((id) => [id, blank(id)]));
  for (const row of byStatus) {
    const s = map.get(row.assignedToId!);
    if (!s) continue;
    const n = row._count._all;
    s.assigned += n;
    if (SENT_STATUSES.includes(row.status)) s.sent += n;
    if (row.status === 'PENDING') s.pending += n;
    if (row.status === 'QUEUED' || row.status === 'SENDING') s.queued += n;
    if (row.status === 'REPLIED') s.replied += n;
    if (row.status === 'BOUNCED') s.bounced += n;
    if (row.status === 'OPTED_OUT') s.optedOut += n;
    if (row.status === 'ERROR') s.errors += n;
  }
  for (const row of last24) {
    const s = map.get(row.userId);
    if (s) s.sentLast24h = row._count._all;
  }
  for (const s of map.values()) s.bounceRate = s.sent ? s.bounced / s.sent : 0;
  return map;
}

export async function remainingForUser(user: User, now = new Date()): Promise<{ cap: number; remaining: number }> {
  const logs = await prisma.sendLog.findMany({
    where: { userId: user.id, result: 'ok', sentAt: { gt: new Date(now.getTime() - DAY_MS) } },
    select: { sentAt: true },
  });
  const cap = effectiveDailyCap({ dailyCap: user.dailyCap, rampEnabled: user.rampEnabled, firstSendAt: user.firstSendAt, now });
  return { cap, remaining: remainingToday(logs.map((l) => l.sentAt), cap, now) };
}
