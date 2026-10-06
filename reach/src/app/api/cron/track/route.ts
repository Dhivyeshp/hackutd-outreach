import { requireCron } from '@/lib/auth';
import { handle, ok } from '@/lib/http';
import { runTrackTick } from '@/lib/tracker';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const run = handle(async (req: Request) => {
  requireCron(req);
  return ok(await runTrackTick());
});

export { run as GET, run as POST };
