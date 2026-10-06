import { randomBytes } from 'node:crypto';

export interface MimeInput {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

const CRLF = '\r\n';
const hasNewline = (s: string) => /[\r\n]/.test(s);
const isAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);
const encodedWord = (s: string) => `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;

function wrap64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64').replace(/(.{76})/g, `$1${CRLF}`);
}

/** Build a single-recipient multipart/alternative RFC 2822 message (never Cc/Bcc). */
export function buildMime(m: MimeInput): string {
  for (const v of [m.fromName, m.fromEmail, m.to, m.subject]) {
    if (hasNewline(v)) throw new Error('Header injection rejected');
  }
  if (/[,;\s]/.test(m.to.trim())) throw new Error('Exactly one recipient is allowed');

  const display = isAscii(m.fromName) ? `"${m.fromName.replace(/(["\\])/g, '\\$1')}"` : encodedWord(m.fromName);
  const boundary = `spark_${randomBytes(12).toString('hex')}`;
  const part = (type: string, body: string) =>
    [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', wrap64(body)].join(CRLF);

  return [
    `From: ${display} <${m.fromEmail}>`,
    `To: ${m.to.trim()}`,
    `Subject: ${isAscii(m.subject) ? m.subject : encodedWord(m.subject)}`,
    `List-Unsubscribe: <mailto:${m.fromEmail}?subject=unsubscribe>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    part('text/plain', m.text),
    part('text/html', m.html),
    `--${boundary}--`,
    '',
  ].join(CRLF);
}

export const toBase64Url = (raw: string): string => Buffer.from(raw, 'utf8').toString('base64url');
