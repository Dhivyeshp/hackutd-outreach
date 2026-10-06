import { cronHandler } from '@/lib/cron';
import { runTrackTick } from '@/lib/tracker';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const run = cronHandler('track', () => runTrackTick());

export { run as GET, run as POST };
