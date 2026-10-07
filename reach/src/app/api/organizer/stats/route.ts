import { requireUser } from '@/lib/auth';
import { composeEmail } from '@/lib/compose';
import { parseKind } from '@/lib/kind';
import { senderOf } from '@/lib/sender';
import { prisma } from '@/lib/db';
import { getCampaign } from '@/lib/engine';
import { handle, ok } from '@/lib/http';
import { getGlobalPause } from '@/lib/settings';
import { allOrganizerStats, remainingForUser } from '@/lib/stats';

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const kind = parseKind(new URL(req.url).searchParams.get('kind'));
  const [stats, limits, campaign, global, next] = await Promise.all([
    allOrganizerStats([user.id], new Date(), kind),
    remainingForUser(user),
    getCampaign(kind),
    getGlobalPause(),
    prisma.contact.findFirst({
      where: { assignedToId: user.id, kind, status: { in: ['QUEUED', 'PENDING'] } },
      orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
    }),
  ]);
  const preview = next
    ? { to: next.email, ...composeEmail(campaign, next, senderOf(user)) }
    : null;
  return ok({
    user: { name: user.name, email: user.email, role: user.role, gmailConnected: user.gmailConnected, paused: user.paused, pausedReason: user.pausedReason, pausedKinds: user.pausedKinds },
    stats: stats.get(user.id),
    limits,
    globalPaused: global.paused ? global.reason : null,
    preview,
  });
});
