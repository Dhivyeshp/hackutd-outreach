import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { composeEmail } from '@/lib/compose';
import { prisma } from '@/lib/db';
import { getCampaign } from '@/lib/engine';
import { handle, ok, parseBody, parseWith } from '@/lib/http';
import { senderOf } from '@/lib/sender';

const PAGE_SIZE = 10;
const query = z.object({ cursor: z.string().min(1).max(64).optional() });
const decide = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  decision: z.enum(['approve', 'skip']),
});

/** Drafts = this organizer's PENDING contacts, rendered exactly as they would be sent. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const { cursor } = parseWith(query, { cursor: new URL(req.url).searchParams.get('cursor') ?? undefined });
  const campaign = await getCampaign();
  const where = {
    assignedToId: user.id,
    status: 'PENDING' as const,
    verification: campaign.allowNonValid ? { not: 'INVALID' as const } : ('VALID' as const),
  };
  const [rows, total] = await Promise.all([
    prisma.contact.findMany({ where, orderBy: { id: 'asc' }, take: PAGE_SIZE + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }),
    prisma.contact.count({ where }),
  ]);
  const page = rows.slice(0, PAGE_SIZE);
  return ok({
    total,
    nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    drafts: page.map((c) => ({
      id: c.id,
      to: c.email,
      name: c.name,
      ...composeEmail(campaign, c, senderOf(user)),
    })),
  });
});

/** Approve = queue for sending. Skip = never send (can be re-assigned by an admin). Only own, still-pending contacts. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { ids, decision } = await parseBody(req, decide);
  const res = await prisma.contact.updateMany({
    where: { id: { in: ids }, assignedToId: user.id, status: 'PENDING' },
    data: { status: decision === 'approve' ? 'QUEUED' : 'SKIPPED' },
  });
  return ok({ updated: res.count });
});
