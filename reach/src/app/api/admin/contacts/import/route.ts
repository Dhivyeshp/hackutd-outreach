import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { importRows, parseCsv, type ImportedContact } from '@/lib/csv-import';
import { prisma } from '@/lib/db';
import { HttpError, handle, ok, parseBody } from '@/lib/http';

export const maxDuration = 60;

const column = z.string().max(200).optional();
const schema = z.object({
  kind: z.enum(['FACULTY', 'SPONSOR']).default('FACULTY'),
  csv: z.string().min(1).max(4_000_000),
  mapping: z.object({
    email: z.string().min(1).max(200),
    name: column,
    title: column,
    department: column,
    uni: column,
    company: column,
    website: column,
    industry: column,
    location: column,
    verification: column,
  }),
});

const CHUNK = 1000;
const toEnum = (v: ImportedContact['verification']) => v.toUpperCase() as 'VALID' | 'RISKY' | 'INVALID' | 'UNKNOWN';

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  if (Number(req.headers.get('content-length') ?? 0) > 5_000_000) throw new HttpError(413, 'CSV too large (max about 4 MB)');
  const { csv, mapping, kind } = await parseBody(req, schema);
  const { headers, rows } = parseCsv(csv);
  if (!headers.includes(mapping.email)) throw new HttpError(400, `Column "${mapping.email}" not found`);

  const existing = new Set((await prisma.contact.findMany({ select: { email: true } })).map((c) => c.email));
  const result = importRows(rows, mapping, existing, kind);

  let created = 0;
  for (let i = 0; i < result.contacts.length; i += CHUNK) {
    const res = await prisma.contact.createMany({
      data: result.contacts.slice(i, i + CHUNK).map((c) => ({
        email: c.email,
        name: c.name,
        title: c.title,
        department: c.department,
        uni: c.uni,
        kind: c.kind,
        company: c.company,
        website: c.website,
        industry: c.industry,
        location: c.location,
        verification: toEnum(c.verification),
        status: c.status === 'invalid' ? 'INVALID' : 'PENDING',
      })),
      skipDuplicates: true,
    });
    created += res.count;
  }
  return ok({ summary: { ...result.summary, imported: created }, rejected: result.rejected.slice(0, 25) });
});
