import { describe, expect, it } from 'vitest';
import { guessMapping, importRows, normalizeVerification, parseCsv } from './csv-import';

const csv = `Name,Email,Title,Dept,University,Status
Jane Smith,Jane@UTD.edu ,Professor,CS,UTD,valid
Bob Lee,bob@utd.edu,Lecturer,CS,UTD,risky
Dup,jane@utd.edu,Professor,CS,UTD,valid
Bad,not-an-email,x,x,x,
Zed,zed@mit.edu,,,MIT,Deliverable
Old,old@mit.edu,,,MIT,undeliverable`;

describe('parseCsv + guessMapping', () => {
  it('parses headers and rows', () => {
    const { headers, rows } = parseCsv(csv);
    expect(headers).toContain('Email');
    expect(rows).toHaveLength(6);
  });
  it('guesses mapping from common header names', () => {
    const m = guessMapping(['Name', 'Email', 'Title', 'Dept', 'University', 'Status']);
    expect(m).toMatchObject({ email: 'Email', name: 'Name', title: 'Title', department: 'Dept', uni: 'University', verification: 'Status' });
  });
});

describe('normalizeVerification', () => {
  it.each([
    ['valid', 'valid'],
    ['Deliverable', 'valid'],
    ['catch-all', 'risky'],
    ['risky', 'risky'],
    ['invalid', 'invalid'],
    ['undeliverable', 'invalid'],
    ['', 'unknown'],
    ['???', 'unknown'],
  ])('%s -> %s', (raw, want) => expect(normalizeVerification(raw)).toBe(want));
});

describe('importRows', () => {
  const { rows, headers } = parseCsv(csv);
  const mapping = guessMapping(headers);
  it('dedupes, lowercases, flags invalid syntax', () => {
    const r = importRows(rows, mapping, new Set());
    expect(r.contacts.map((c) => c.email)).toEqual(['jane@utd.edu', 'bob@utd.edu', 'zed@mit.edu', 'old@mit.edu']);
    expect(r.summary).toMatchObject({ total: 6, imported: 4, duplicates: 1, invalidSyntax: 1 });
  });
  it('skips emails already in db', () => {
    const r = importRows(rows, mapping, new Set(['bob@utd.edu']));
    expect(r.contacts.map((c) => c.email)).not.toContain('bob@utd.edu');
    expect(r.summary.duplicates).toBe(2);
  });
  it('imports verification and marks invalid-verified status', () => {
    const r = importRows(rows, mapping, new Set());
    expect(r.contacts.find((c) => c.email === 'zed@mit.edu')?.verification).toBe('valid');
    expect(r.contacts.find((c) => c.email === 'old@mit.edu')).toMatchObject({ verification: 'invalid', status: 'invalid' });
  });
  it('requires an email mapping', () => {
    expect(() => importRows(rows, { ...mapping, email: undefined }, new Set())).toThrow(/email/i);
  });
});
