import { parseName } from './name-parser';

export interface TemplateContact {
  name?: string | null;
  title?: string | null;
  department?: string | null;
  uni?: string | null;
  company?: string | null;
  industry?: string | null;
  website?: string | null;
  location?: string | null;
}

export interface Sender {
  name: string;
  title?: string | null;
  email?: string | null;
}

const DEFAULT_SENDER_TITLE = 'Organizer';

function valuesFor(contact: TemplateContact, sender: Sender): Record<string, string> {
  const n = parseName(contact.name);
  const company = contact.company?.trim() ?? '';
  const hasPerson = !!contact.name?.trim();
  // Sponsor lists often have only a company and a generic address, so greet the team, not "Professor".
  const sponsor = company !== '';
  return {
    name: n.full,
    first_name: sponsor && !hasPerson ? 'there' : n.first,
    last_name: n.last,
    prof_last_name: n.last,
    greeting: sponsor ? (hasPerson ? `Hi ${n.first}` : `Hi ${company} team`) : n.last ? `Hi Professor ${n.last}` : 'Hello',
    title: contact.title ?? '',
    department: contact.department ?? '',
    uni: contact.uni ?? '',
    company,
    industry: contact.industry ?? '',
    website: contact.website ?? '',
    location: contact.location ?? '',
    sender_name: sender.name,
    sender_title: sender.title?.trim() || DEFAULT_SENDER_TITLE,
    sender_email: sender.email ?? '',
  };
}

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
const lookup = (values: Record<string, string>, key: string) => (Object.hasOwn(values, key) ? values[key] : '');

export function renderTemplate(template: string, contact: TemplateContact, sender: Sender | string): string {
  const s: Sender = typeof sender === 'string' ? { name: sender } : sender;
  const values = valuesFor(contact, s);
  return template.replace(PLACEHOLDER, (_, key: string) => lookup(values, key));
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** Render an HTML template. Values come from untrusted CSV data, so every substitution is HTML-escaped. */
export function renderHtmlTemplate(html: string, contact: TemplateContact, sender: Sender): string {
  const values = valuesFor(contact, sender);
  return (
    html
      .replace(PLACEHOLDER, (_, key: string) => escapeHtml(lookup(values, key)))
      // "Hi Professor {{prof_last_name}}," with no known last name becomes "Hello,"
      .replace(/Hi Professor\s*,/g, 'Hello,')
  );
}

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

export const OPT_OUT_LINE = "If you'd rather not hear from us, just reply STOP and I'll take you off the list.";
