import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpError, handle, ok, parseBody } from '@/lib/http';
import { HARD_MAX_DAILY } from '@/lib/limits';
import { allOrganizerStats } from '@/lib/stats';

const domain = () => (process.env.ALLOWED_DOMAIN ?? 'acmutd.co').toLowerCase();

const invite = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase()),
  name: z.string().max(120).optional(),
  role: z.enum(['ADMIN', 'ORGANIZER']).default('ORGANIZER'),
});

const patch = z.object({
  id: z.string().min(1),
  role: z.enum(['ADMIN', 'ORGANIZER']).optional(),
  paused: z.boolean().optional(),
  disabled: z.boolean().optional(),
  rampEnabled: z.boolean().optional(),
  dailyCap: z.number().int().min(0).max(HARD_MAX_DAILY).optional(),
  timezone: z.string().max(64).optional(),
});

export const GET = handle(async () => {
  await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  const stats = await allOrganizerStats(users.map((u) => u.id));
  return ok(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      timezone: u.timezone,
      gmailConnected: u.gmailConnected,
      dailyCap: u.dailyCap,
      rampEnabled: u.rampEnabled,
      paused: u.paused,
      pausedReason: u.pausedReason,
      disabled: u.disabled,
      stats: stats.get(u.id),
    })),
  );
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await parseBody(req, invite);
  if (body.email.split('@')[1] !== domain()) throw new HttpError(400, `Email must be @${domain()}`);
  const user = await prisma.user.upsert({
    where: { email: body.email },
    update: { role: body.role, disabled: false },
    create: { email: body.email, name: body.name ?? '', role: body.role },
  });
  return ok({ id: user.id }, { status: 201 });
});

export const PATCH = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const { id, paused, disabled, ...fields } = await parseBody(req, patch);
  if (fields.timezone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: fields.timezone });
    } catch {
      throw new HttpError(400, 'Unknown timezone');
    }
  }
  if (id === admin.id && (fields.role === 'ORGANIZER' || disabled)) throw new HttpError(400, 'You cannot demote or disable yourself');
  if (fields.role === 'ORGANIZER' && (await prisma.user.count({ where: { role: 'ADMIN', disabled: false, id: { not: id } } })) === 0) {
    throw new HttpError(400, 'There must be at least one admin');
  }

  const data: Record<string, unknown> = { ...fields };
  if (paused === true) Object.assign(data, { paused: true, pausedReason: 'manual', pausedUntil: null, pausedByAdmin: true });
  if (paused === false) {
    // Resume restarts bounce counting so the same old bounces cannot instantly re-pause the user.
    Object.assign(data, { paused: false, pausedReason: null, pausedUntil: null, pausedByAdmin: false, bounceCheckSince: new Date() });
  }
  if (disabled === true) {
    Object.assign(data, { disabled: true, paused: true, pausedReason: 'disabled', gmailConnected: false, encryptedRefreshToken: null });
  }
  if (disabled === false) Object.assign(data, { disabled: false });

  await prisma.user.update({ where: { id }, data });
  return ok({ updated: true });
});
