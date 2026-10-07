import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCampaign } from '@/lib/engine';
import { HttpError, handle, ok, parseBody } from '@/lib/http';
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
  abEnabled: z.boolean().default(false),
  abPercentB: z.number().int().min(1).max(99).default(50),
  bSubject: z.string().max(200).nullable().default(null),
  bBody: z.string().max(10_000).nullable().default(null),
  bHtmlBody: z.string().max(200_000).nullable().default(null),
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
  if (data.abEnabled && (!data.bSubject?.trim() || !data.bBody?.trim())) {
    throw new HttpError(400, 'Version B needs its own subject and text before the A/B test can run', 'E_AB_INCOMPLETE');
  }
  const id = campaignIdFor(kind);
  const campaign = await prisma.campaign.upsert({ where: { id }, update: data, create: { id, ...data } });
  return ok({ campaign, warnings: lintTemplate(campaign) });
});
