'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
import { EmailPreview } from './EmailPreview';
import { Button, Card, Notice } from './ui';

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
  total: number;
  nextCursor: string | null;
  drafts: Draft[];
}

export function DraftReview() {
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setPage(await api<Page>('/api/organizer/drafts'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function decide(ids: string[], decision: 'approve' | 'skip') {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ updated: number }>('/api/organizer/drafts', { body: { ids, decision } });
      setMsg(decision === 'approve' ? `${r.updated} approved. They send during your next send window.` : `${r.updated} skipped.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!page) return error ? <Notice tone="red">{error}</Notice> : <p className="text-zinc-500">Loading drafts…</p>;

  return (
    <div className="space-y-5">
      {error && <Notice tone="red">{error}</Notice>}
      {msg && <Notice tone="green">{msg}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          {page.total} draft{page.total === 1 ? '' : 's'} waiting for your approval. Nothing is sent until you approve it.
        </p>
        {page.drafts.length > 0 && (
          <Button disabled={busy} onClick={() => decide(page.drafts.map((d) => d.id), 'approve')}>
            Approve these {page.drafts.length}
          </Button>
        )}
      </div>

      {page.drafts.length === 0 && (
        <Card className="space-y-2">
          <p className="text-sm text-zinc-400">No drafts to review.</p>
          <Link href="/" className="text-sm font-medium text-rose-300 hover:underline">
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
              <Button variant="secondary" disabled={busy} onClick={() => decide([d.id], 'skip')}>
                Skip
              </Button>
              <Button disabled={busy} onClick={() => decide([d.id], 'approve')}>
                Approve
              </Button>
            </div>
          </div>
          <EmailPreview html={d.html} text={d.text} isHtmlTemplate={d.isHtmlTemplate} />
        </Card>
      ))}
    </div>
  );
}
