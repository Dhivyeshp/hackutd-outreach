import { requireCron } from '@/lib/auth';
import { runSendTick } from '@/lib/engine';
import { handle, ok } from '@/lib/http';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const run = handle(async (req: Request) => {
  requireCron(req);
  return ok(await runSendTick());
});

export { run as GET, run as POST };
