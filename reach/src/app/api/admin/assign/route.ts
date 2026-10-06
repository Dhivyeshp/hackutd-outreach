import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { assignRoundRobin } from '@/lib/assign';
import { prisma } from '@/lib/db';
import { getCampaign } from '@/lib/engine';
import { handle, ok, parseBody } from '@/lib/http';

export const maxDuration = 60;

const auto = z.object({ max: z.number().int().min(1).max(5000).optional() });
const manual = z.object({
  contactIds: z.array(z.string().min(1)).min(1).max(5000),
  userId: z.string().min(1).nullable(),
});

/** Auto-assign: round-robin unassigned valid contacts across organizers, capped per organizer. */
export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const { max } = await parseBody(req, auto);
  const campaign = await getCampaign();
  const cap = max ?? campaign.maxPerOrganizer;

  const organizers = await prisma.user.findMany({ where: { role: 'ORGANIZER' }, select: { id: true } });
  const loads = await prisma.contact.groupBy({
    by: ['assignedToId'],
    where: { assignedToId: { in: organizers.map((o) => o.id) } },
    _count: { _all: true },
  });
  const loadOf = new Map(loads.map((l) => [l.assignedToId, l._count._all]));

  const unassigned = await prisma.contact.findMany({
    where: { assignedToId: null, status: 'PENDING', verification: campaign.allowNonValid ? { not: 'INVALID' } : 'VALID' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  const plan = assignRoundRobin(
    unassigned.map((c) => c.id),
    organizers.map((o) => ({ id: o.id, load: loadOf.get(o.id) ?? 0 })),
    cap,
  );

  const byUser = new Map<string, string[]>();
  for (const a of plan.assignments) byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a.contactId]);
  await prisma.$transaction(
    [...byUser].map(([userId, ids]) => prisma.contact.updateMany({ where: { id: { in: ids } }, data: { assignedToId: userId } })),
  );
  return ok({ assigned: plan.assignments.length, leftUnassigned: plan.unassigned.length, perOrganizerMax: cap });
});

/** Manual reassign of contacts that have not been sent yet. */
export const PATCH = handle(async (req: Request) => {
  await requireAdmin();
  const { contactIds, userId } = await parseBody(req, manual);
  const res = await prisma.contact.updateMany({
    where: {
      id: { in: contactIds },
      // Contacts whose send state is unconfirmed may already have been delivered: never re-queue those.
      OR: [
        { status: { in: ['PENDING', 'QUEUED'] } },
        { status: 'ERROR', NOT: { errorNote: { startsWith: 'Send state unconfirmed' } } },
      ],
    },
    data: { assignedToId: userId, status: 'PENDING', errorNote: null },
  });
  return ok({ reassigned: res.count });
});
