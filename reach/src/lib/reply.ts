const FOOTER_LINE = /reply stop|rather not hear from us|take you off the list/i;
const OUTLOOK_HEADER = /^\s*(from|sent|de|von):\s.*(@|\d{4})/i;

/** Drop quoted history and our own footer so we only judge what the recipient actually typed. */
export function stripQuoted(text: string): string {
  const out: string[] = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*On .+wrote:\s*$/i.test(line) || /^\s*-{2,}\s*Original Message/i.test(line)) break;
    if (/^\s*_{5,}\s*$/.test(line) || OUTLOOK_HEADER.test(line)) break;
    if (/^\s*>/.test(line) || FOOTER_LINE.test(line)) continue;
    out.push(line);
  }
  return out.join('\n');
}

// Explicit phrases, or a bare "stop"/"remove" as the whole message. "stop by my office" is a normal reply.
const OPT_OUT_PHRASE =
  /\b(unsubscribe|opt[\s-]?out|not\s+interested|remove\s+(me|us|my)|take\s+(me|us)\s+off|(please\s+)?stop\s+(emailing|e-mailing|contacting|sending|writing)|do\s+not\s+(email|contact)|don'?t\s+(email|contact))\b/i;
const OPT_OUT_BARE = /^\W*(please\s+)?(stop|remove|unsubscribe)\W*$/i;

export function detectOptOut(text: string): boolean {
  const body = stripQuoted(text).trim();
  return OPT_OUT_PHRASE.test(body) || OPT_OUT_BARE.test(body);
}
