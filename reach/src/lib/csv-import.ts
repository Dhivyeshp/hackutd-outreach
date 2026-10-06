import Papa from 'papaparse';

export type Verification = 'valid' | 'risky' | 'invalid' | 'unknown';
export type ContactField = 'email' | 'name' | 'title' | 'department' | 'uni' | 'verification';
export type Mapping = Partial<Record<ContactField, string | undefined>>;

export interface ImportedContact {
  email: string;
  name: string;
  title: string;
  department: string;
  uni: string;
  verification: Verification;
  status: 'pending' | 'invalid';
}

export interface ImportResult {
  contacts: ImportedContact[];
  rejected: { row: number; reason: string; value: string }[];
  summary: { total: number; imported: number; duplicates: number; invalidSyntax: number; invalidVerified: number };
}

const ALIASES: Record<ContactField, string[]> = {
  email: ['email', 'e-mail', 'email address', 'mail'],
  name: ['name', 'full name', 'professor', 'faculty'],
  title: ['title', 'position', 'role'],
  department: ['department', 'dept', 'division'],
  uni: ['uni', 'university', 'school', 'institution'],
  verification: ['verification', 'status', 'result', 'verify', 'zb status', 'neverbounce result'],
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

export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  for (const field of Object.keys(ALIASES) as ContactField[]) {
    mapping[field] = headers.find((h) => ALIASES[field].includes(h.trim().toLowerCase()));
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

export function importRows(rows: Record<string, string>[], mapping: Mapping, existing: ReadonlySet<string>): ImportResult {
  if (!mapping.email) throw new Error('An email column mapping is required');
  const get = (row: Record<string, string>, f: ContactField) => {
    const col = mapping[f];
    const v = col && Object.hasOwn(row, col) ? row[col] : '';
    return typeof v === 'string' ? v.trim() : '';
  };
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
    const verification = mapping.verification ? normalizeVerification(get(row, 'verification')) : 'unknown';
    if (verification === 'invalid') result.summary.invalidVerified++;
    result.contacts.push({
      email,
      name: get(row, 'name'),
      title: get(row, 'title'),
      department: get(row, 'department'),
      uni: get(row, 'uni'),
      verification,
      status: verification === 'invalid' ? 'invalid' : 'pending',
    });
    result.summary.imported++;
  });
  return result;
}
