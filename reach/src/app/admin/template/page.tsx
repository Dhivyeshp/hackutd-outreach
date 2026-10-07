'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Notice, inputCls } from '@/components/ui';
import { api } from '@/lib/client-api';
import { EmailPreview } from '@/components/EmailPreview';
import { useKind } from '@/components/KindContext';
import { contentFor, type Variant } from '@/lib/ab';
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
  abEnabled: boolean;
  abPercentB: number;
  bSubject: string | null;
  bBody: string | null;
  bHtmlBody: string | null;
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

// Which Campaign fields hold the subject, text and HTML of each version.
const FIELDS = {
  A: { subject: 'subject', body: 'body', html: 'htmlBody' },
  B: { subject: 'bSubject', body: 'bBody', html: 'bHtmlBody' },
} as const;

export default function TemplatePage() {
  const { kind } = useKind();
  const [c, setC] = useState<Campaign | null>(null);
  const [sample, setSample] = useState<Sample>(FALLBACK_SAMPLES.FACULTY);
  const [version, setVersion] = useState<Variant>('A');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setC(null);
    setError('');
    setVersion('A');
    api<{ campaign: Campaign; sample: Sample | null }>(`/api/admin/template?kind=${kind}`)
      .then((d) => {
        setC(d.campaign);
        setSample(d.sample ?? FALLBACK_SAMPLES[kind]);
      })
      .catch((e: Error) => setError(e.message));
  }, [kind]);

  const shown = c && version === 'B' ? contentFor({ ...c, bSubject: c.bSubject ?? '', bBody: c.bBody ?? '' }, 'B') : c;
  const warnings = useMemo(() => (shown ? lintTemplate({ subject: shown.subject, body: shown.htmlBody?.trim() ? shown.htmlBody : shown.body }) : []), [shown]);
  const preview = useMemo(() => (shown ? composeEmail(shown, sample, { name: 'Your Name', title: 'Organizer', email: 'you@acmutd.co' }) : null), [shown, sample]);

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
  const f = FIELDS[version];
  const subject = (c[f.subject] as string | null) ?? '';
  const body = (c[f.body] as string | null) ?? '';
  const html = (c[f.html] as string | null) ?? '';
  const placeholders = kind === 'SPONSOR' ? '{{greeting}} {{company}} {{industry}} {{website}} {{location}} {{sender_name}} {{sender_title}} {{sender_email}}' : '{{name}} {{first_name}} {{last_name}} {{title}} {{department}} {{uni}} {{sender_name}}';
  const typeOf = (h: string | null) => (h?.trim() ? 'HTML' : 'plain text');

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="space-y-4">
        {error && <Notice tone="red">{error}</Notice>}

        <div className="space-y-2 rounded-xl border border-white/10 p-3 text-sm">
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" checked={c.abEnabled} onChange={(e) => set('abEnabled', e.target.checked)} /> A/B test two versions
          </label>
          <p className="text-xs text-zinc-500">
            Each contact gets A or B at random and always the same one. Compare reply rates on the Dashboard. To test plain text against HTML, keep one version plain and give the other an HTML template.
          </p>
          {c.abEnabled && (
            <label className="flex items-center gap-2">
              <span className="text-zinc-400">Send version B to</span>
              <input
                className={`${inputCls} w-20`}
                type="number"
                min={1}
                max={99}
                value={c.abPercentB}
                onChange={(e) => set('abPercentB', Math.min(99, Math.max(1, Number(e.target.value) || 50)))}
              />
              <span className="text-zinc-400">% of contacts (A gets the rest)</span>
            </label>
          )}
        </div>

        {(c.abEnabled || c.bSubject || c.bBody) && (
          <div role="tablist" aria-label="Template version" className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            {(['A', 'B'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={version === v}
                onClick={() => setVersion(v)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${version === v ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
              >
                Version {v} <span className="text-xs text-zinc-500">{typeOf(v === 'A' ? c.htmlBody : c.bHtmlBody)}</span>
              </button>
            ))}
          </div>
        )}
        {version === 'B' && !c.bBody && (
          <Button variant="secondary" onClick={() => setC({ ...c, bSubject: c.subject, bBody: c.body })}>
            Start B as a copy of A's text
          </Button>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Subject{c.abEnabled ? ` (version ${version})` : ''}</span>
          <input className={inputCls} value={subject} onChange={(e) => set(f.subject, e.target.value as never)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Body{c.abEnabled ? ` (version ${version})` : ''}</span>
          <textarea className={`${inputCls} h-64 font-mono`} value={body} onChange={(e) => set(f.body, e.target.value as never)} />
          <span className="mt-1 block text-xs text-zinc-500">{placeholders}</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">HTML template (optional){c.abEnabled ? ` (version ${version})` : ''}</span>
          <textarea
            className={`${inputCls} h-48 font-mono text-xs`}
            value={html}
            placeholder="Paste a full HTML email here. When set, it replaces the plain-text body above. Leave empty for a plain-text email."
            onChange={(e) => set(f.html, (e.target.value.trim() ? e.target.value : null) as never)}
          />
          <span className="mt-1 block text-xs text-zinc-500">The STOP opt-out line is added automatically.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Mailing address (added to plain-text emails with a STOP line)</span>
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
          <h2 className="font-semibold">Live preview{c.abEnabled ? ` · version ${version}` : ''}</h2>
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
