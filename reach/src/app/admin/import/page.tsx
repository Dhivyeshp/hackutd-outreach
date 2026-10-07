'use client';

import { useEffect, useState } from 'react';
import { useKind } from '@/components/KindContext';
import { Button, Card, Notice, inputCls } from '@/components/ui';
import { api } from '@/lib/client-api';
import { guessMapping, parseCsv, type ContactField } from '@/lib/csv-import';
import { KIND_LABEL, KINDS, type Kind } from '@/lib/kind';

interface FieldDef {
  key: ContactField;
  label: string;
  required?: boolean;
}

const VERIFICATION: FieldDef = { key: 'verification', label: 'Verification (NeverBounce / ZeroBounce)' };

const FIELDS: Record<Kind, FieldDef[]> = {
  FACULTY: [
    { key: 'email', label: 'Email', required: true },
    { key: 'name', label: 'Name' },
    { key: 'title', label: 'Title' },
    { key: 'department', label: 'Department' },
    { key: 'uni', label: 'University' },
    VERIFICATION,
  ],
  SPONSOR: [
    { key: 'email', label: 'Email', required: true },
    { key: 'company', label: 'Company' },
    { key: 'name', label: 'Contact person (optional)' },
    { key: 'title', label: 'Their title (optional)' },
    { key: 'website', label: 'Website' },
    { key: 'industry', label: 'Industry' },
    { key: 'location', label: 'Location' },
    VERIFICATION,
  ],
};

const HINT: Record<Kind, string> = {
  FACULTY: 'Scraped professor lists. Without a verification column, contacts stay "unknown" and are only sent if you allow it on the Template tab.',
  SPONSOR: 'Company lists with a generic address (like partnerships@). Without a verification column, sponsor contacts are treated as valid. Emails greet "Hi <company> team".',
};

interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  disabled: boolean;
}

interface Summary {
  total: number;
  imported: number;
  duplicates: number;
  invalidSyntax: number;
  invalidVerified: number;
  undeliverable: number;
}

interface Scan {
  dryRun: boolean;
  checked: number;
  domains: number;
  unknownDomains: number;
  undeliverable: number;
  wasQueued: number;
  examples: string[];
}

export default function ImportPage() {
  const { kind, setKind } = useKind();
  const [csv, setCsv] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState<Partial<Record<ContactField, string>>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [assignMsg, setAssignMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  // Empty set means "everyone"; otherwise only the ticked people get contacts.
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [maxEach, setMaxEach] = useState('');
  const [scan, setScan] = useState<Scan | null>(null);

  useEffect(() => {
    api<Person[]>('/api/admin/organizers')
      .then((list) => setPeople(list.filter((p) => !p.disabled)))
      .catch((e) => setError((e as Error).message));
  }, []);

  function togglePerson(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  // Switching between Faculty and Sponsors re-guesses the column match for the file already chosen.
  useEffect(() => {
    if (headers.length) setMapping(guessMapping(headers, kind) as Partial<Record<ContactField, string>>);
    setSummary(null);
    setAssignMsg('');
    setScan(null);
  }, [kind, headers]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    const text = await file.text();
    const parsed = parseCsv(text);
    setCsv(text);
    setRowCount(parsed.rows.length);
    setHeaders(parsed.headers);
  }

  async function runImport() {
    setBusy(true);
    setError('');
    try {
      const res = await api<{ summary: Summary }>('/api/admin/contacts/import', { body: { csv, mapping, kind } });
      setSummary(res.summary);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runScan(dryRun: boolean) {
    setBusy(true);
    setError('');
    try {
      setScan(await api<Scan>('/api/admin/contacts/check', { body: { kind, dryRun } }));
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
      const r = await api<{ assigned: number; leftUnassigned: number; perOrganizerMax: number }>('/api/admin/assign', {
        body: { kind, ...(picked.size ? { userIds: [...picked] } : {}), ...(Number(maxEach) > 0 ? { max: Number(maxEach) } : {}) },
      });
      setAssignMsg(`Assigned ${r.assigned} ${KIND_LABEL[kind].toLowerCase()} contacts (max ${r.perOrganizerMax} per organizer). ${r.leftUnassigned} left unassigned.`);
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold">1. Import CSV</h2>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-zinc-500">What are you importing?</span>
            <select className={`${inputCls} w-48`} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-zinc-500">{HINT[kind]}</p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
        {headers.length > 0 && (
          <>
            <p className="text-sm text-zinc-400">{rowCount.toLocaleString()} rows. Match your columns:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS[kind].map((f) => (
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
              {busy ? 'Importing…' : `Import ${KIND_LABEL[kind].toLowerCase()}`}
            </Button>
          </>
        )}
        {summary && (
          <Notice tone="green">
            Imported {summary.imported.toLocaleString()} of {summary.total.toLocaleString()} rows. {summary.duplicates} duplicates skipped, {summary.invalidSyntax} missing or bad emails,{' '}
            {summary.invalidVerified} marked invalid by your verification column, {summary.undeliverable} skipped because their domain cannot receive email.
          </Notice>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Check for undeliverable addresses</h2>
        <p className="text-sm text-zinc-400">
          Looks up every {KIND_LABEL[kind].toLowerCase()} contact that has not been sent yet and finds email domains that cannot receive mail at all. Those are the ones that bounce with "address not found". It cannot catch a mailbox that does not exist on a working domain.
          New imports are checked automatically.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => runScan(true)}>
            {busy ? 'Checking…' : 'Scan'}
          </Button>
          {scan?.dryRun && scan.undeliverable > 0 && (
            <Button disabled={busy} onClick={() => runScan(false)}>
              Remove {scan.undeliverable} undeliverable
            </Button>
          )}
        </div>
        {scan && (
          <Notice tone={scan.undeliverable ? 'amber' : 'green'}>
            Checked {scan.checked.toLocaleString()} contacts across {scan.domains.toLocaleString()} domains. {scan.undeliverable}{' '}
            {scan.dryRun ? 'would be removed' : 'removed and will never be sent'} ({scan.wasQueued} were already approved).
            {scan.unknownDomains > 0 && ` ${scan.unknownDomains} domains could not be looked up and were left alone.`}
            {scan.examples.length > 0 && ` Examples: ${scan.examples.join(', ')}.`}
          </Notice>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">2. Auto-assign {KIND_LABEL[kind].toLowerCase()}</h2>
        <p className="text-sm text-zinc-400">Splits unassigned contacts of this type round-robin. Tick specific people to give only them the contacts, or leave all unticked to include everyone.</p>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm">
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => togglePerson(p.id)} />
              {p.name || p.email}
              {p.role === 'ADMIN' && <span className="text-xs text-zinc-500">admin</span>}
            </label>
          ))}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-zinc-500">Max per person (blank = the limit on the Template tab)</span>
          <input className={`${inputCls} w-40`} inputMode="numeric" value={maxEach} onChange={(e) => setMaxEach(e.target.value.replace(/\D/g, ''))} />
        </label>
        <Button disabled={busy} onClick={autoAssign}>
          {picked.size ? `Assign to ${picked.size} selected` : `Auto-assign ${KIND_LABEL[kind].toLowerCase()} to everyone`}
        </Button>
        {assignMsg && <Notice tone="green">{assignMsg}</Notice>}
      </Card>
    </div>
  );
}
