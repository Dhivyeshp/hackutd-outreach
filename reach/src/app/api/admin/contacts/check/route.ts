import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { handle, ok, parseBody } from '@/lib/http';
import { checkDomains, domainOf } from '@/lib/mx';

export const maxDuration = 60;

const schema = z.object({
  kind: z.enum(['FACULTY', 'SPONSOR']).default('FACULTY'),
  /** Only count what would be removed, without changing anything. */
  dryRun: z.boolean().default(false),
});

const CHUNK = 500;
const NOTE = 'Domain has no mail server';

/**
 * Find contacts whose email domain cannot receive mail (no MX or address record) among those not yet sent,
 * and mark them INVALID so they are never emailed. Lookup failures are treated as fine, so only definite
 * dead domains are removed. This catches dead domains, not mailboxes that do not exist on a live domain.
 */
export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const { kind, dryRun } = await parseBody(req, schema);

  const contacts = await prisma.contact.findMany({
    where: { kind, status: { in: ['PENDING', 'QUEUED'] } },
    select: { id: true, email: true, status: true },
  });
  const statuses = await checkDomains(contacts.map((c) => domainOf(c.email)));
  const dead = contacts.filter((c) => statuses.get(domainOf(c.email)) === 'dead');
  const deadDomains = [...new Set(dead.map((c) => domainOf(c.email)))];

  if (!dryRun) {
    for (let i = 0; i < dead.length; i += CHUNK) {
      await prisma.contact.updateMany({
        where: { id: { in: dead.slice(i, i + CHUNK).map((c) => c.id) }, status: { in: ['PENDING', 'QUEUED'] } },
        data: { status: 'INVALID', verification: 'INVALID', errorNote: NOTE },
      });
    }
  }
  return ok({
    dryRun,
    checked: contacts.length,
    domains: statuses.size,
    unknownDomains: [...statuses.values()].filter((s) => s === 'unknown').length,
    undeliverable: dead.length,
    wasQueued: dead.filter((c) => c.status === 'QUEUED').length,
    examples: deadDomains.slice(0, 15),
  });
});
