import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { abActive, contentFor, variantFor } from '@/lib/ab';
import { composeEmail } from '@/lib/compose';
import { prisma } from '@/lib/db';
import { getCampaign } from '@/lib/engine';
import { HttpError, handle, ok, parseBody, parseWith } from '@/lib/http';
import { senderOf } from '@/lib/sender';

const PAGE_SIZE = 10;
/** Approve-all unlocks once this many emails of the kind have been looked at (approved, skipped, or already sent). */
const REVIEW_FIRST = 10;
const query = z.object({
  cursor: z.string().min(1).max(64).optional(),
  view: z.enum(['drafts', 'queued']).default('drafts'),
  kind: z.enum(['FACULTY', 'SPONSOR']).default('FACULTY'),
});
const decide = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(100).optional(),
    /** Act on every email of this kind at once. Only valid with decision "hold" or "approve". */
    all: z.literal(true).optional(),
    decision: z.enum(['approve', 'skip', 'hold']),
    kind: z.enum(['FACULTY', 'SPONSOR']).default('FACULTY'),
  })
  .refine((v) => (v.all ? v.decision === 'hold' || v.decision === 'approve' : !!v.ids), {
    message: 'Provide ids, or all:true with decision "hold" or "approve"',
  });

/** Emails of one kind this organizer has already decided on: approved, skipped, or past that (sent, replied, bounced...). */
const countReviewed = (userId: string, kind: 'FACULTY' | 'SPONSOR') =>
  prisma.contact.count({ where: { assignedToId: userId, kind, status: { notIn: ['PENDING', 'INVALID', 'DUPLICATE'] } } });

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
  const [rows, drafts, queued, reviewed] = await Promise.all([
    prisma.contact.findMany({
      where: view === 'queued' ? queuedWhere : pendingWhere,
      orderBy: { id: 'asc' },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.contact.count({ where: pendingWhere }),
    prisma.contact.count({ where: queuedWhere }),
    countReviewed(user.id, kind),
  ]);
  const page = rows.slice(0, PAGE_SIZE);
  return ok({
    view,
    counts: { drafts, queued, reviewed, reviewFirst: REVIEW_FIRST },
    nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    drafts: page.map((c) => {
      const variant = variantFor(campaign, c.id);
      return {
        id: c.id,
        to: c.email,
        name: c.name,
        // Which A/B version this contact gets; null when no test is running.
        variant: abActive(campaign) ? variant : null,
        ...composeEmail(contentFor(campaign, variant), c, senderOf(user)),
      };
    }),
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
  if (all && decision === 'approve' && (await countReviewed(user.id, kind)) < REVIEW_FIRST) {
    throw new HttpError(409, `Review and approve at least ${REVIEW_FIRST} emails first, then you can approve the rest at once`, 'E_REVIEW_FIRST');
  }
  // Approve-all must respect the same verification rule as the list the organizer saw.
  const campaign = decision === 'approve' && all ? await getCampaign(kind) : null;
  const verification = campaign ? { verification: campaign.allowNonValid ? { not: 'INVALID' as const } : ('VALID' as const) } : {};
  const res = await prisma.contact.updateMany({
    where: { ...(all ? { kind, ...verification } : { id: { in: ids } }), assignedToId: user.id, status: { in: rule.from } },
    data: { status: rule.to },
  });
  return ok({ updated: res.count });
});
