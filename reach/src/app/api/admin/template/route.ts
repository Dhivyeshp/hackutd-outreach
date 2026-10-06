import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCampaign } from '@/lib/engine';
import { handle, ok, parseBody } from '@/lib/http';
import { lintTemplate } from '@/lib/linter';

const update = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
  htmlBody: z.string().max(200_000).nullable(),
  mailingAddress: z.string().min(5).max(300),
  allowNonValid: z.boolean(),
  active: z.boolean(),
  maxPerOrganizer: z.number().int().min(1).max(5000),
});

export const GET = handle(async () => {
  await requireAdmin();
  const campaign = await getCampaign();
  const sample = await prisma.contact.findFirst({
    where: { verification: 'VALID' },
    orderBy: { createdAt: 'asc' },
    select: { name: true, title: true, department: true, uni: true, email: true },
  });
  return ok({ campaign, sample, warnings: lintTemplate(campaign) });
});

export const PUT = handle(async (req: Request) => {
  await requireAdmin();
  const data = await parseBody(req, update);
  const campaign = await prisma.campaign.upsert({ where: { id: 'default' }, update: data, create: { id: 'default', ...data } });
  return ok({ campaign, warnings: lintTemplate(campaign) });
});
