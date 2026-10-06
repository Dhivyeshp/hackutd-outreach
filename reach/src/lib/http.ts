import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json({ success: true, data }, init);

export const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status });

const formatZod = (e: ZodError) => e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');

export function parseWith<T>(schema: ZodType<T>, raw: unknown): T {
  const res = schema.safeParse(raw);
  if (!res.success) throw new HttpError(400, formatZod(res.error));
  return res.data;
}

/** Parse + validate a JSON body with Zod. Throws HttpError(400) on bad input. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'Body must be valid JSON');
  }
  return parseWith(schema, raw);
}

/** Browsers always send Origin on cross-site POSTs; reject when it does not match this host. */
function assertSameOrigin(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('origin');
  if (!origin) return; // non-browser callers (cron) carry a bearer token instead
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (new URL(origin).host !== host) throw new HttpError(403, 'Cross-origin request blocked');
}

const isPrismaNotFound = (err: unknown) => typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2025';

/** Wrap a route handler so thrown HttpErrors / unexpected errors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      if (args[0] instanceof Request) assertSameOrigin(args[0]);
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message);
      if (isPrismaNotFound(err)) return fail(404, 'Not found');
      process.stderr.write(`route error: ${err instanceof Error ? err.stack : String(err)}\n`);
      return fail(500, 'Internal server error');
    }
  };
}
