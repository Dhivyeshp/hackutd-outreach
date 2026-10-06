'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Notice, inputCls } from '@/components/ui';
import { api } from '@/lib/client-api';
import { composeEmail } from '@/lib/compose';
import { lintTemplate } from '@/lib/linter';

interface Campaign {
  subject: string;
  body: string;
  mailingAddress: string;
  allowNonValid: boolean;
  active: boolean;
  maxPerOrganizer: number;
}
interface Sample {
  name: string;
  title: string;
  department: string;
  uni: string;
  email: string;
}

const FALLBACK_SAMPLE: Sample = { name: 'Dr. Jane Smith', title: 'Associate Professor', department: 'Computer Science', uni: 'Example University', email: 'jane@example.edu' };

export default function TemplatePage() {
  const [c, setC] = useState<Campaign | null>(null);
  const [sample, setSample] = useState<Sample>(FALLBACK_SAMPLE);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ campaign: Campaign; sample: Sample | null }>('/api/admin/template')
      .then((d) => {
        setC(d.campaign);
        if (d.sample) setSample(d.sample);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const warnings = useMemo(() => (c ? lintTemplate(c) : []), [c]);
  const preview = useMemo(() => (c ? composeEmail(c, sample, 'Your Name') : null), [c, sample]);

  async function save() {
    if (!c) return;
    setError('');
    try {
      await api('/api/admin/template', { method: 'PUT', body: c });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!c) return error ? <Notice tone="red">{error}</Notice> : <p className="text-slate-500">Loading…</p>;
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC({ ...c, [k]: v });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="space-y-4">
        {error && <Notice tone="red">{error}</Notice>}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Subject</span>
          <input className={inputCls} value={c.subject} onChange={(e) => set('subject', e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Body</span>
          <textarea className={`${inputCls} h-64 font-mono`} value={c.body} onChange={(e) => set('body', e.target.value)} />
          <span className="mt-1 block text-xs text-slate-500">
            {'{{name}} {{first_name}} {{last_name}} {{title}} {{department}} {{uni}} {{sender_name}}'}
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Mailing address (added to the footer with a STOP line)</span>
          <input className={inputCls} value={c.mailingAddress} onChange={(e) => set('mailingAddress', e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label>
            <span className="mb-1 block font-medium">Max contacts per organizer</span>
            <input className={inputCls} type="number" min={1} max={5000} value={c.maxPerOrganizer} onChange={(e) => set('maxPerOrganizer', Number(e.target.value))} />
          </label>
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={c.active} onChange={(e) => set('active', e.target.checked)} /> Campaign active
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={c.allowNonValid} onChange={(e) => set('allowNonValid', e.target.checked)} /> Also send to risky/unknown
            </label>
          </div>
        </div>
        {warnings.map((w) => (
          <Notice key={w.code}>{w.message}</Notice>
        ))}
        <Button onClick={save}>{saved ? 'Saved' : 'Save template'}</Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Live preview</h2>
          <Badge>{sample.name || 'sample'}</Badge>
        </div>
        {preview && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="text-slate-500">To: {sample.email}</div>
            <div className="mt-1 font-semibold">{preview.subject}</div>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-slate-700">{preview.text}</pre>
          </div>
        )}
      </Card>
    </div>
  );
}
