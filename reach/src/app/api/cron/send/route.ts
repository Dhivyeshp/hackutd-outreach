import { cronHandler } from '@/lib/cron';
import { runSendTick } from '@/lib/engine';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const run = cronHandler('send', () => runSendTick());

export { run as GET, run as POST };
