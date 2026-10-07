import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';

/** Stable error codes, so a screenshot of an error is enough to find the cause. Default comes from the HTTP status. */
const STATUS_CODES: Record<number, string> = {
  400: 'E_BAD_REQUEST',
  401: 'E_UNAUTHENTICATED',
  403: 'E_FORBIDDEN',
  404: 'E_NOT_FOUND',
  409: 'E_CONFLICT',
  415: 'E_BAD_CONTENT_TYPE',
  429: 'E_RATE_LIMITED',
  500: 'E_INTERNAL',
  502: 'E_UPSTREAM',
};
export const codeForStatus = (status: number): string => STATUS_CODES[status] ?? `E_HTTP_${status}`;

export class HttpError extends Error {
  public code: string;
  constructor(
    public status: number,
    message: string,
    code?: string,
  ) {
    super(message);
    this.code = code ?? codeForStatus(status);
  }
}

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json({ success: true, data }, init);

export const fail = (status: number, error: string, code: string = codeForStatus(status)) =>
  NextResponse.json({ success: false, error, code }, { status });

const formatZod = (e: ZodError) => e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');

export function parseWith<T>(schema: ZodType<T>, raw: unknown): T {
  const res = schema.safeParse(raw);
  if (!res.success) throw new HttpError(400, formatZod(res.error), 'E_VALIDATION');
  return res.data;
}

/** Parse + validate a JSON body with Zod. Throws HttpError(400) on bad input. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json', 'E_BAD_CONTENT_TYPE');
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'Body must be valid JSON', 'E_BAD_JSON');
  }
  return parseWith(schema, raw);
}

/** Browsers always send Origin on cross-site POSTs; reject when it does not match this host. */
function assertSameOrigin(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('origin');
  if (!origin) return; // non-browser callers (cron) carry a bearer token instead
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (new URL(origin).host !== host) throw new HttpError(403, 'Cross-origin request blocked', 'E_CROSS_ORIGIN');
}

const isPrismaNotFound = (err: unknown) => typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2025';

/** Wrap a route handler so thrown HttpErrors / unexpected errors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      if (args[0] instanceof Request) assertSameOrigin(args[0]);
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message, err.code);
      if (isPrismaNotFound(err)) return fail(404, 'Not found', 'E_NOT_FOUND');
      // The ref ties the message on screen to the matching stack trace in the server logs.
      const ref = Math.random().toString(16).slice(2, 8);
      process.stderr.write(`route error [E_INTERNAL ${ref}]: ${err instanceof Error ? err.stack : String(err)}\n`);
      return fail(500, `Internal server error (ref ${ref})`, 'E_INTERNAL');
    }
  };
}
