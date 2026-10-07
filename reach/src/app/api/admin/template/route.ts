import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCampaign } from '@/lib/engine';
import { handle, ok, parseBody } from '@/lib/http';
import { campaignIdFor, parseKind } from '@/lib/kind';
import { lintTemplate } from '@/lib/linter';

const update = z.object({
  kind: z.enum(['FACULTY', 'SPONSOR']).default('FACULTY'),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
  htmlBody: z.string().max(200_000).nullable(),
  mailingAddress: z.string().min(5).max(300),
  allowNonValid: z.boolean(),
  active: z.boolean(),
  maxPerOrganizer: z.number().int().min(1).max(5000),
});

export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const kind = parseKind(new URL(req.url).searchParams.get('kind'));
  const campaign = await getCampaign(kind);
  const sample = await prisma.contact.findFirst({
    where: { kind, ...(kind === 'FACULTY' ? { verification: 'VALID' as const } : {}) },
    orderBy: { createdAt: 'asc' },
    select: { name: true, title: true, department: true, uni: true, company: true, industry: true, website: true, location: true, email: true },
  });
  return ok({ campaign, sample, warnings: lintTemplate(campaign) });
});

export const PUT = handle(async (req: Request) => {
  await requireAdmin();
  const { kind, ...data } = await parseBody(req, update);
  const id = campaignIdFor(kind);
  const campaign = await prisma.campaign.upsert({ where: { id }, update: data, create: { id, ...data } });
  return ok({ campaign, warnings: lintTemplate(campaign) });
});
