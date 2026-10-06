import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { handle, ok, parseBody } from '@/lib/http';
import { PROJECT_QUOTA_PAUSE_UNITS } from '@/lib/limits';
import { getGlobalPause, quotaToday, resumeAll, setGlobalPause } from '@/lib/settings';
import { allOrganizerStats } from '@/lib/stats';

const action = z.object({ action: z.enum(['pause_all', 'resume_all', 'resolve_alerts']) });

export const GET = handle(async () => {
  await requireAdmin();
  const users = await prisma.user.findMany({ where: { disabled: false }, orderBy: { createdAt: 'asc' } });
  const [stats, quota, global, alerts, unassigned] = await Promise.all([
    allOrganizerStats(users.map((u) => u.id)),
    quotaToday(),
    getGlobalPause(),
    prisma.alert.findMany({ where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.contact.count({ where: { assignedToId: null, status: 'PENDING' } }),
  ]);
  return ok({
    organizers: users.map((u) => ({
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      paused: u.paused,
      pausedReason: u.pausedReason,
      gmailConnected: u.gmailConnected,
      stats: stats.get(u.id),
    })),
    quota: { used: quota, pauseAt: PROJECT_QUOTA_PAUSE_UNITS },
    global,
    alerts,
    unassigned,
  });
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const { action: a } = await parseBody(req, action);
  if (a === 'pause_all') await setGlobalPause(true, 'Paused manually by admin');
  if (a === 'resume_all') await resumeAll();
  if (a === 'resolve_alerts') await prisma.alert.updateMany({ where: { resolved: false }, data: { resolved: true } });
  return ok({ done: a });
});
