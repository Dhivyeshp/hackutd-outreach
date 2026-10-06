import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendTestEmail, startSending } from '@/lib/engine';
import { GmailError } from '@/lib/gmail';
import { HttpError, handle, ok, parseBody } from '@/lib/http';

export const maxDuration = 60;

const schema = z.object({ action: z.enum(['test', 'start', 'pause']) });

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { action } = await parseBody(req, schema);

  if (action === 'pause') {
    // Never overwrite a safety or admin pause with a plain manual one.
    if (!user.paused) {
      await prisma.user.update({ where: { id: user.id }, data: { paused: true, pausedReason: 'manual', pausedUntil: null, pausedByAdmin: false } });
    }
    return ok({ paused: true });
  }
  if (!user.gmailConnected) throw new HttpError(400, 'Connect Gmail first');

  if (action === 'test') {
    try {
      await sendTestEmail(user);
    } catch (err) {
      if (err instanceof GmailError) throw new HttpError(err.kind === 'rate_limit' ? 429 : 502, err.message);
      throw err;
    }
    return ok({ sentTo: user.email });
  }

  const ownPause = user.paused && user.pausedReason === 'manual' && !user.pausedByAdmin;
  if (user.paused && !ownPause) {
    throw new HttpError(409, `Sending is paused: ${user.pausedReason ?? 'see admin'}. Ask an admin to resume.`);
  }
  return ok(await startSending(user));
});
