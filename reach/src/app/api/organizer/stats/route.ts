import { requireUser } from '@/lib/auth';
import { composeEmail } from '@/lib/compose';
import { prisma } from '@/lib/db';
import { getCampaign } from '@/lib/engine';
import { handle, ok } from '@/lib/http';
import { getGlobalPause } from '@/lib/settings';
import { allOrganizerStats, remainingForUser } from '@/lib/stats';

export const GET = handle(async () => {
  const user = await requireUser();
  const [stats, limits, campaign, global, next] = await Promise.all([
    allOrganizerStats([user.id]),
    remainingForUser(user),
    getCampaign(),
    getGlobalPause(),
    prisma.contact.findFirst({
      where: { assignedToId: user.id, status: { in: ['QUEUED', 'PENDING'] } },
      orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
    }),
  ]);
  const preview = next
    ? { to: next.email, ...composeEmail(campaign, next, user.name || user.email) }
    : null;
  return ok({
    user: { name: user.name, email: user.email, role: user.role, gmailConnected: user.gmailConnected, paused: user.paused, pausedReason: user.pausedReason },
    stats: stats.get(user.id),
    limits,
    globalPaused: global.paused ? global.reason : null,
    preview,
  });
});
