import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { sendTestEmail, setKindPaused, startSending } from '@/lib/engine';
import { GmailError } from '@/lib/gmail';
import { HttpError, handle, ok, parseBody } from '@/lib/http';

export const maxDuration = 60;

const schema = z.object({
  action: z.enum(['test', 'start', 'pause', 'resume']),
  kind: z.enum(['FACULTY', 'SPONSOR']).default('FACULTY'),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { action, kind } = await parseBody(req, schema);

  // Pause and resume apply to one kind only, so pausing sponsors leaves faculty sending and the reverse.
  if (action === 'pause' || action === 'resume') {
    await setKindPaused(user, kind, action === 'pause');
    return ok({ kind, paused: action === 'pause' });
  }
  if (!user.gmailConnected) throw new HttpError(400, 'Connect Gmail first', 'E_GMAIL_NOT_CONNECTED');

  if (action === 'test') {
    try {
      await sendTestEmail(user, kind);
    } catch (err) {
      if (err instanceof GmailError) throw new HttpError(err.kind === 'rate_limit' ? 429 : 502, err.message, `E_GMAIL_${err.kind.toUpperCase()}`);
      throw err;
    }
    return ok({ sentTo: user.email });
  }

  const ownPause = user.paused && user.pausedReason === 'manual' && !user.pausedByAdmin;
  if (user.paused && !ownPause) {
    throw new HttpError(409, `Sending is paused: ${user.pausedReason ?? 'see admin'}. Ask an admin to resume.`, 'E_USER_PAUSED');
  }
  return ok(await startSending(user, kind));
});
