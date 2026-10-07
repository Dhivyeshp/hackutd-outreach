'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Notice, inputCls } from '@/components/ui';
import { api } from '@/lib/client-api';
import { EmailPreview } from '@/components/EmailPreview';
import { useKind } from '@/components/KindContext';
import { composeEmail } from '@/lib/compose';
import { lintTemplate } from '@/lib/linter';

interface Campaign {
  subject: string;
  body: string;
  htmlBody: string | null;
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
  company?: string;
  industry?: string;
  website?: string;
  location?: string;
  email: string;
}

const FALLBACK_SAMPLES: Record<'FACULTY' | 'SPONSOR', Sample> = {
  FACULTY: { name: 'Dr. Jane Smith', title: 'Associate Professor', department: 'Computer Science', uni: 'Example University', email: 'jane@example.edu' },
  SPONSOR: { name: '', title: '', department: '', uni: '', company: 'Example Corp', industry: 'Software', website: 'https://example.com', location: 'Dallas', email: 'partnerships@example.com' },
};

export default function TemplatePage() {
  const { kind } = useKind();
  const [c, setC] = useState<Campaign | null>(null);
  const [sample, setSample] = useState<Sample>(FALLBACK_SAMPLES.FACULTY);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setC(null);
    setError('');
    api<{ campaign: Campaign; sample: Sample | null }>(`/api/admin/template?kind=${kind}`)
      .then((d) => {
        setC(d.campaign);
        setSample(d.sample ?? FALLBACK_SAMPLES[kind]);
      })
      .catch((e: Error) => setError(e.message));
  }, [kind]);

  const warnings = useMemo(() => (c ? lintTemplate({ subject: c.subject, body: c.htmlBody?.trim() ? c.htmlBody : c.body }) : []), [c]);
  const preview = useMemo(() => (c ? composeEmail(c, sample, { name: 'Your Name', title: 'Organizer' }) : null), [c, sample]);

  async function save() {
    if (!c) return;
    setError('');
    try {
      await api('/api/admin/template', { method: 'PUT', body: { ...c, kind } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!c) return error ? <Notice tone="red">{error}</Notice> : <p className="text-zinc-500">Loading…</p>;
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
          <span className="mt-1 block text-xs text-zinc-500">
            {kind === 'SPONSOR' ? '{{greeting}} {{company}} {{industry}} {{website}} {{location}} {{first_name}} {{sender_name}}' : '{{name}} {{first_name}} {{last_name}} {{title}} {{department}} {{uni}} {{sender_name}}'}
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">HTML template (optional)</span>
          <textarea
            className={`${inputCls} h-48 font-mono text-xs`}
            value={c.htmlBody ?? ''}
            placeholder="Paste a full HTML email here. When set, it replaces the plain-text body above."
            onChange={(e) => set('htmlBody', e.target.value.trim() ? e.target.value : null)}
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Placeholders: {kind === 'SPONSOR' ? '{{greeting}} {{company}} {{sender_name}} {{sender_title}}' : '{{prof_last_name}} {{sender_name}} {{sender_title}}'} plus the ones above. The STOP opt-out line is added automatically.
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
          <div className="space-y-3">
            <div className="text-sm">
              <div className="text-zinc-500">To: {sample.email}</div>
              <div className="mt-0.5 font-semibold">{preview.subject}</div>
            </div>
            <EmailPreview html={preview.html} text={preview.text} isHtmlTemplate={preview.isHtmlTemplate} height={640} />
          </div>
        )}
      </Card>
    </div>
  );
}
