import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { abActive, compareReplyRates } from '@/lib/ab';
import { getCampaign } from '@/lib/engine';
import { handle, ok, parseBody } from '@/lib/http';
import { parseKind } from '@/lib/kind';
import { PROJECT_QUOTA_PAUSE_UNITS } from '@/lib/limits';
import { getGlobalPause, quotaToday, resumeAll, setGlobalPause } from '@/lib/settings';
import { allOrganizerStats } from '@/lib/stats';

const action = z.object({ action: z.enum(['pause_all', 'resume_all', 'resolve_alerts']) });

interface VariantCounts {
  sent: number;
  replied: number;
  bounced: number;
  optedOut: number;
}
const SENT = new Set(['SENT', 'REPLIED', 'BOUNCED', 'OPTED_OUT']);

/** Per-version totals and a cautious winner call. Null when no test is running and nothing has been collected. */
function abResults(rows: { variant: string | null; status: string; _count: { _all: number } }[], running: boolean, percentB: number) {
  const totals: Record<'A' | 'B', VariantCounts> = {
    A: { sent: 0, replied: 0, bounced: 0, optedOut: 0 },
    B: { sent: 0, replied: 0, bounced: 0, optedOut: 0 },
  };
  for (const r of rows) {
    if (r.variant !== 'A' && r.variant !== 'B') continue;
    const t = totals[r.variant];
    const n = r._count._all;
    if (SENT.has(r.status)) t.sent += n;
    if (r.status === 'REPLIED') t.replied += n;
    if (r.status === 'BOUNCED') t.bounced += n;
    if (r.status === 'OPTED_OUT') t.optedOut += n;
  }
  if (!running && totals.A.sent + totals.B.sent === 0) return null;
  return { running, percentB, ...totals, ...compareReplyRates(totals.A, totals.B) };
}

export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const kind = parseKind(new URL(req.url).searchParams.get('kind'));
  const users = await prisma.user.findMany({ where: { disabled: false }, orderBy: { createdAt: 'asc' } });
  const [stats, quota, global, alerts, unassigned, byVariant, campaign] = await Promise.all([
    allOrganizerStats(users.map((u) => u.id), new Date(), kind),
    quotaToday(),
    getGlobalPause(),
    prisma.alert.findMany({ where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.contact.count({ where: { assignedToId: null, status: 'PENDING', kind } }),
    prisma.contact.groupBy({ by: ['variant', 'status'], where: { kind, variant: { not: null } }, _count: { _all: true } }),
    getCampaign(kind),
  ]);
  const ab = abResults(byVariant, abActive(campaign), campaign.abPercentB);
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
    ab,
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
