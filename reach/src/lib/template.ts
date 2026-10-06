import { parseName } from './name-parser';

export interface TemplateContact {
  name?: string | null;
  title?: string | null;
  department?: string | null;
  uni?: string | null;
}

export function renderTemplate(template: string, contact: TemplateContact, senderName: string): string {
  const n = parseName(contact.name);
  const values: Record<string, string> = {
    name: n.full,
    first_name: n.first,
    last_name: n.last,
    title: contact.title ?? '',
    department: contact.department ?? '',
    uni: contact.uni ?? '',
    sender_name: senderName,
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => (Object.hasOwn(values, key) ? values[key] : ''));
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => {
      const html = escapeHtml(p)
        .replace(/(https?:\/\/[^\s<]+?)([.,;:!?)]*)(?=\s|<|$)/g, '<a href="$1">$1</a>$2')
        .replace(/\n/g, '<br>');
      return `<p style="margin:0 0 1em">${html}</p>`;
    })
    .join('');
}

/** CAN-SPAM-style footer: clear opt-out instruction plus a physical address. */
export function appendFooter(body: string, mailingAddress: string): string {
  return `${body.trimEnd()}\n\n--\nIf you'd rather not hear from us, just reply STOP and I'll take you off the list.\n${mailingAddress}`;
}
