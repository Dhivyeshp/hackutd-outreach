import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { composeEmail } from '@/lib/compose';
import { prisma } from '@/lib/db';
import { getCampaign } from '@/lib/engine';
import { handle, ok, parseBody, parseWith } from '@/lib/http';
import { senderOf } from '@/lib/sender';

const PAGE_SIZE = 10;
const query = z.object({
  cursor: z.string().min(1).max(64).optional(),
  view: z.enum(['drafts', 'queued']).default('drafts'),
  kind: z.enum(['FACULTY', 'SPONSOR']).default('FACULTY'),
});
const decide = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(100).optional(),
    /** Pull every queued email back to drafts in one go. Only valid with decision "hold". */
    all: z.literal(true).optional(),
    decision: z.enum(['approve', 'skip', 'hold']),
    kind: z.enum(['FACULTY', 'SPONSOR']).default('FACULTY'),
  })
  .refine((v) => (v.all ? v.decision === 'hold' : !!v.ids), { message: 'Provide ids, or all:true with decision "hold"' });

/**
 * view=drafts: this organizer's PENDING contacts (waiting for approval).
 * view=queued: contacts already approved but not yet sent. Both are rendered exactly as they would be sent.
 */
export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const params = new URL(req.url).searchParams;
  const { cursor, view, kind } = parseWith(query, {
    cursor: params.get('cursor') ?? undefined,
    view: params.get('view') ?? undefined,
    kind: params.get('kind') ?? undefined,
  });
  const campaign = await getCampaign(kind);
  const verification = campaign.allowNonValid ? { not: 'INVALID' as const } : ('VALID' as const);
  const pendingWhere = { assignedToId: user.id, kind, status: 'PENDING' as const, verification };
  const queuedWhere = { assignedToId: user.id, kind, status: 'QUEUED' as const };
  const [rows, drafts, queued] = await Promise.all([
    prisma.contact.findMany({
      where: view === 'queued' ? queuedWhere : pendingWhere,
      orderBy: { id: 'asc' },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.contact.count({ where: pendingWhere }),
    prisma.contact.count({ where: queuedWhere }),
  ]);
  const page = rows.slice(0, PAGE_SIZE);
  return ok({
    view,
    counts: { drafts, queued },
    nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    drafts: page.map((c) => ({
      id: c.id,
      to: c.email,
      name: c.name,
      ...composeEmail(campaign, c, senderOf(user)),
    })),
  });
});

/**
 * approve: PENDING -> QUEUED (will send). hold: QUEUED -> PENDING (pull back before it sends).
 * skip: PENDING or QUEUED -> SKIPPED (never send). Only own contacts, and only if not already claimed by a send run.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { ids, all, decision, kind } = await parseBody(req, decide);
  const rule = {
    approve: { from: ['PENDING'], to: 'QUEUED' },
    hold: { from: ['QUEUED'], to: 'PENDING' },
    skip: { from: ['PENDING', 'QUEUED'], to: 'SKIPPED' },
  }[decision] as { from: ('PENDING' | 'QUEUED')[]; to: 'PENDING' | 'QUEUED' | 'SKIPPED' };
  const res = await prisma.contact.updateMany({
    where: { ...(all ? { kind } : { id: { in: ids } }), assignedToId: user.id, status: { in: rule.from } },
    data: { status: rule.to },
  });
  return ok({ updated: res.count });
});
