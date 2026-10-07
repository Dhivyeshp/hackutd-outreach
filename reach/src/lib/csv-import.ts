import Papa from 'papaparse';
import type { Kind } from './kind';

export type Verification = 'valid' | 'risky' | 'invalid' | 'unknown';
export type ContactField =
  | 'email'
  | 'name'
  | 'title'
  | 'department'
  | 'uni'
  | 'company'
  | 'website'
  | 'industry'
  | 'location'
  | 'verification';
export type Mapping = Partial<Record<ContactField, string | undefined>>;

export interface ImportedContact {
  email: string;
  kind: Kind;
  name: string;
  title: string;
  department: string;
  uni: string;
  company: string;
  website: string;
  industry: string;
  location: string;
  verification: Verification;
  status: 'pending' | 'invalid';
}

export interface ImportResult {
  contacts: ImportedContact[];
  rejected: { row: number; reason: string; value: string }[];
  summary: { total: number; imported: number; duplicates: number; invalidSyntax: number; invalidVerified: number };
}

const VERIFICATION_ALIASES = ['verification', 'status', 'result', 'verify', 'zb status', 'neverbounce result'];

/** Which fields each kind of list uses, with the CSV header names we auto-match. */
export const FIELDS_BY_KIND: Record<Kind, Partial<Record<ContactField, string[]>>> = {
  FACULTY: {
    email: ['email', 'e-mail', 'email address', 'mail'],
    name: ['name', 'full name', 'professor', 'faculty'],
    title: ['title', 'position', 'role'],
    department: ['department', 'dept', 'dept_hint', 'division'],
    uni: ['uni', 'university', 'school', 'institution'],
    verification: VERIFICATION_ALIASES,
  },
  SPONSOR: {
    email: ['best_email', 'email', 'e-mail', 'email address', 'contact email', 'mail'],
    company: ['name', 'company', 'company name', 'organization', 'organisation'],
    name: ['contact_name', 'contact name', 'contact', 'person', 'full name'],
    title: ['title', 'position', 'role'],
    website: ['website', 'url', 'site'],
    industry: ['industry', 'sector'],
    location: ['location', 'city', 'hq'],
    verification: VERIFICATION_ALIASES,
  },
};

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return { headers: res.meta.fields ?? [], rows: res.data };
}

export function guessMapping(headers: string[], kind: Kind = 'FACULTY'): Mapping {
  const mapping: Mapping = {};
  for (const [field, aliases] of Object.entries(FIELDS_BY_KIND[kind]) as [ContactField, string[]][]) {
    mapping[field] = headers.find((h) => aliases.includes(h.trim().toLowerCase()));
  }
  return mapping;
}

export function normalizeVerification(raw: string | undefined): Verification {
  const v = (raw ?? '').trim().toLowerCase();
  if (['valid', 'deliverable', 'ok', 'good', 'safe', 'pass'].includes(v)) return 'valid';
  if (['risky', 'catch-all', 'catchall', 'catch_all', 'accept_all', 'accept-all', 'role', 'disposable'].includes(v)) return 'risky';
  if (['invalid', 'undeliverable', 'bad', 'bounce', 'do_not_mail', 'spamtrap', 'abuse'].includes(v)) return 'invalid';
  return 'unknown';
}

export function isValidEmailSyntax(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

/**
 * Sponsor lists are hand-curated, so without a verification column they are treated as valid.
 * Faculty lists are scraped, so without one they stay "unknown".
 */
export function importRows(
  rows: Record<string, string>[],
  mapping: Mapping,
  existing: ReadonlySet<string>,
  kind: Kind = 'FACULTY',
): ImportResult {
  if (!mapping.email) throw new Error('An email column mapping is required');
  const get = (row: Record<string, string>, f: ContactField) => {
    const col = mapping[f];
    const v = col && Object.hasOwn(row, col) ? row[col] : '';
    return typeof v === 'string' ? v.trim() : '';
  };
  const defaultVerification: Verification = kind === 'SPONSOR' ? 'valid' : 'unknown';
  const seen = new Set(existing);
  const result: ImportResult = {
    contacts: [],
    rejected: [],
    summary: { total: rows.length, imported: 0, duplicates: 0, invalidSyntax: 0, invalidVerified: 0 },
  };

  rows.forEach((row, i) => {
    const email = get(row, 'email').toLowerCase();
    if (!isValidEmailSyntax(email)) {
      result.summary.invalidSyntax++;
      result.rejected.push({ row: i + 2, reason: 'invalid email syntax', value: email });
      return;
    }
    if (seen.has(email)) {
      result.summary.duplicates++;
      return;
    }
    seen.add(email);
    const verification = mapping.verification ? normalizeVerification(get(row, 'verification')) : defaultVerification;
    if (verification === 'invalid') result.summary.invalidVerified++;
    result.contacts.push({
      email,
      kind,
      name: get(row, 'name'),
      title: get(row, 'title'),
      department: get(row, 'department'),
      uni: get(row, 'uni'),
      company: get(row, 'company'),
      website: get(row, 'website'),
      industry: get(row, 'industry'),
      location: get(row, 'location'),
      verification,
      status: verification === 'invalid' ? 'invalid' : 'pending',
    });
    result.summary.imported++;
  });
  return result;
}
