export interface MessagePart {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: MessagePart[] | null;
  headers?: { name?: string | null; value?: string | null }[] | null;
}

export function headerValue(payload: MessagePart | undefined | null, name: string): string {
  const h = payload?.headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

const decode = (data: string) => Buffer.from(data, 'base64url').toString('utf8');

/** Collect text/plain bodies from a (possibly nested) Gmail message payload. */
export function extractText(payload: MessagePart | undefined | null): string {
  if (!payload) return '';
  const out: string[] = [];
  const walk = (p: MessagePart) => {
    if (p.mimeType === 'text/plain' && p.body?.data) out.push(decode(p.body.data));
    p.parts?.forEach(walk);
  };
  walk(payload);
  if (!out.length && payload.body?.data) out.push(decode(payload.body.data));
  return out.join('\n');
}

/** Bare address from "Name <a@b.com>" or "a@b.com". */
export function addressOf(headerFrom: string): string {
  const m = headerFrom.match(/<([^>]+)>/);
  return (m ? m[1] : headerFrom).trim().toLowerCase();
}
