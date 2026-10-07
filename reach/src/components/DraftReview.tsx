'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
import { EmailPreview } from './EmailPreview';
import { Button, Card, Notice } from './ui';

type View = 'drafts' | 'queued';
type Decision = 'approve' | 'skip' | 'hold';

interface Draft {
  id: string;
  to: string;
  name: string;
  subject: string;
  text: string;
  html: string;
  isHtmlTemplate: boolean;
}
interface Page {
  view: View;
  counts: { drafts: number; queued: number };
  nextCursor: string | null;
  drafts: Draft[];
}

export function DraftReview() {
  const [view, setView] = useState<View>('drafts');
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (v: View) => {
    try {
      setPage(await api<Page>(`/api/organizer/drafts?view=${v}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load(view);
  }, [load, view]);

  async function decide(body: { ids?: string[]; all?: true; decision: Decision }, done: string) {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ updated: number }>('/api/organizer/drafts', { body });
      setMsg(`${r.updated} ${done}`);
      await load(view);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!page) return error ? <Notice tone="red">{error}</Notice> : <p className="text-zinc-500">Loading drafts…</p>;

  const queuedView = view === 'queued';
  const tab = (v: View, label: string, n: number) => (
    <button
      onClick={() => {
        setMsg('');
        setPage(null);
        setView(v);
      }}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === v ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'}`}
    >
      {label} <span className="text-zinc-500">({n})</span>
    </button>
  );

  return (
    <div className="space-y-5">
      {error && <Notice tone="red">{error}</Notice>}
      {msg && <Notice tone="green">{msg}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {tab('drafts', 'To review', page.counts.drafts)}
          {tab('queued', 'Approved, not sent yet', page.counts.queued)}
        </div>
        {queuedView && page.counts.queued > 0 && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => window.confirm(`Pull all ${page.counts.queued} queued emails back to drafts? Sending stops until you approve them again.`) && decide({ all: true, decision: 'hold' }, 'pulled back to drafts.')}
          >
            Pull all {page.counts.queued} back to drafts
          </Button>
        )}
        {!queuedView && page.drafts.length > 0 && (
          <Button disabled={busy} onClick={() => decide({ ids: page.drafts.map((d) => d.id), decision: 'approve' }, 'approved. They send during your next send window.')}>
            Approve these {page.drafts.length}
          </Button>
        )}
      </div>

      <p className="text-sm text-zinc-400">
        {queuedView
          ? 'These are approved and will send automatically. A send run may take some at any moment. Pull any back or skip them here.'
          : 'Nothing is sent until you approve it.'}
      </p>

      {page.drafts.length === 0 && (
        <Card className="space-y-2">
          <p className="text-sm text-zinc-400">{queuedView ? 'Nothing is waiting in the queue.' : 'No drafts to review.'}</p>
          {!queuedView && page.counts.queued > 0 && (
            <button onClick={() => setView('queued')} className="text-sm font-medium text-rose-300 hover:underline">
              {page.counts.queued} already approved, see them
            </button>
          )}
          <Link href="/" className="block text-sm font-medium text-rose-300 hover:underline">
            Back to outreach
          </Link>
        </Card>
      )}

      {page.drafts.map((d) => (
        <Card key={d.id} className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-zinc-500">To: {d.to}</div>
              <div className="truncate font-semibold">{d.subject}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => decide({ ids: [d.id], decision: 'skip' }, 'skipped.')}>
                Skip
              </Button>
              {queuedView ? (
                <Button variant="secondary" disabled={busy} onClick={() => decide({ ids: [d.id], decision: 'hold' }, 'pulled back to drafts.')}>
                  Pull back
                </Button>
              ) : (
                <Button disabled={busy} onClick={() => decide({ ids: [d.id], decision: 'approve' }, 'approved.')}>
                  Approve
                </Button>
              )}
            </div>
          </div>
          <EmailPreview html={d.html} text={d.text} isHtmlTemplate={d.isHtmlTemplate} />
        </Card>
      ))}
    </div>
  );
}
