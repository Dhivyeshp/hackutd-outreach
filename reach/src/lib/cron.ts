import { after } from 'next/server';
import { requireCron } from './auth';
import { handle, ok } from './http';

/**
 * Build a cron route handler. External schedulers (cron-job.org) give up after ~30s, but a send tick takes
 * minutes (25-45s between emails). So reply immediately and keep working after the response is sent.
 * Add ?wait=1 to run synchronously and get the result back (handy for manual debugging).
 */
export function cronHandler<T>(name: string, run: () => Promise<T>) {
  return handle(async (req: Request) => {
    requireCron(req);
    if (new URL(req.url).searchParams.get('wait') === '1') return ok(await run());

    after(async () => {
      try {
        await run();
      } catch (err) {
        process.stderr.write(`cron ${name} failed: ${err instanceof Error ? err.stack : String(err)}\n`);
      }
    });
    return ok({ accepted: true, job: name }, { status: 202 });
  });
}
