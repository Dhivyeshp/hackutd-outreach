'use client';

import { useState } from 'react';
import { Button, Card, Notice, inputCls } from '@/components/ui';
import { api } from '@/lib/client-api';
import { guessMapping, parseCsv, type ContactField } from '@/lib/csv-import';

const FIELDS: { key: ContactField; label: string; required?: boolean }[] = [
  { key: 'email', label: 'Email', required: true },
  { key: 'name', label: 'Name' },
  { key: 'title', label: 'Title' },
  { key: 'department', label: 'Department' },
  { key: 'uni', label: 'University' },
  { key: 'verification', label: 'Verification (NeverBounce / ZeroBounce)' },
];

interface Summary {
  total: number;
  imported: number;
  duplicates: number;
  invalidSyntax: number;
  invalidVerified: number;
}

export default function ImportPage() {
  const [csv, setCsv] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState<Partial<Record<ContactField, string>>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [assignMsg, setAssignMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setSummary(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    setCsv(text);
    setHeaders(parsed.headers);
    setRowCount(parsed.rows.length);
    setMapping(guessMapping(parsed.headers) as Partial<Record<ContactField, string>>);
  }

  async function runImport() {
    setBusy(true);
    setError('');
    try {
      const res = await api<{ summary: Summary }>('/api/admin/contacts/import', { body: { csv, mapping } });
      setSummary(res.summary);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function autoAssign() {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ assigned: number; leftUnassigned: number; perOrganizerMax: number }>('/api/admin/assign', { body: {} });
      setAssignMsg(`Assigned ${r.assigned} contacts (max ${r.perOrganizerMax} per organizer). ${r.leftUnassigned} left unassigned.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && <Notice tone="red">{error}</Notice>}

      <Card className="space-y-4">
        <h2 className="font-semibold">1. Import CSV</h2>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
        {headers.length > 0 && (
          <>
            <p className="text-sm text-zinc-400">{rowCount.toLocaleString()} rows. Match your columns:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <label key={f.key} className="text-sm">
                  <span className="mb-1 block font-medium">
                    {f.label}
                    {f.required && ' *'}
                  </span>
                  <select className={inputCls} value={mapping[f.key] ?? ''} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}>
                    <option value="">(none)</option>
                    {headers.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <Button disabled={busy || !mapping.email} onClick={runImport}>
              {busy ? 'Importing…' : 'Import contacts'}
            </Button>
          </>
        )}
        {summary && (
          <Notice tone="green">
            Imported {summary.imported.toLocaleString()} of {summary.total.toLocaleString()} rows. {summary.duplicates} duplicates skipped, {summary.invalidSyntax} bad emails,{' '}
            {summary.invalidVerified} marked invalid by your verification column.
          </Notice>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">2. Auto-assign</h2>
        <p className="text-sm text-zinc-400">Splits unassigned, valid contacts round-robin across organizers (max per organizer is set on the Template tab).</p>
        <Button disabled={busy} onClick={autoAssign}>
          Auto-assign contacts
        </Button>
        {assignMsg && <Notice tone="green">{assignMsg}</Notice>}
      </Card>
    </div>
  );
}
