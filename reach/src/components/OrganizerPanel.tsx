'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
import Link from 'next/link';
import { EmailPreview } from './EmailPreview';
import { ConnectGmailButton } from './SignInButton';
import { Badge, Button, Card, Notice, Progress, Stat } from './ui';

interface Data {
  user: { name: string; email: string; role: string; gmailConnected: boolean; paused: boolean; pausedReason: string | null };
  stats: { assigned: number; pending: number; queued: number; sent: number; replied: number; bounced: number; optedOut: number; sentLast24h: number };
  limits: { cap: number; remaining: number };
  globalPaused: string | null;
  preview: { to: string; subject: string; text: string; html: string; isHtmlTemplate: boolean } | null;
}

export function OrganizerPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Data>('/api/organizer/stats'));
    } catch (e) {
      setMsg({ tone: 'red', text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: 'test' | 'start' | 'pause') {
    setBusy(action);
    setMsg(null);
    try {
      const res = await api<{ queued?: number; sentTo?: string }>('/api/organizer/actions', { body: { action } });
      const text =
        action === 'test' ? `Test sent to ${res.sentTo}. Check your inbox.` : action === 'start' ? `Sending started. ${res.queued} contacts queued.` : 'Paused.';
      setMsg({ tone: 'green', text });
      await load();
    } catch (e) {
      setMsg({ tone: 'red', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <p className="text-zinc-500">Loading…</p>;
  const { user, stats, limits, preview } = data;

  if (!user.gmailConnected) {
    return (
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Connect your Gmail</h2>
        <p className="text-sm text-zinc-400">SPARK sends from your own @acmutd.co inbox. One consent screen, nothing else to set up.</p>
        <ConnectGmailButton />
      </Card>
    );
  }

  const status = user.paused ? <Badge tone="amber">Paused{user.pausedReason ? `: ${user.pausedReason}` : ''}</Badge> : stats.queued ? <Badge tone="green" live>Sending</Badge> : <Badge>Idle</Badge>;

  return (
    <div className="space-y-5">
      {data.globalPaused && <Notice tone="red">All sending is paused by an admin: {data.globalPaused}</Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Your outreach</h2>
          {status}
        </div>
        <div className="mb-4">
          <Progress value={limits.cap - limits.remaining} max={limits.cap} label={`Today: ${limits.cap - limits.remaining} of ${limits.cap} sent`} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Sent" value={stats.sent} hint={`${stats.sentLast24h} in last 24h`} />
          <Stat label="Replied" value={stats.replied} />
          <Stat label="Bounced" value={stats.bounced} />
          <Stat label="Left today" value={limits.remaining} hint={`of ${limits.cap}`} />
        </div>
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/[0.06] pt-4 text-sm">
          {[
            ['Assigned', stats.assigned],
            ['Pending', stats.pending],
            ['Queued', stats.queued],
            ['Opted out', stats.optedOut],
          ].map(([label, n]) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="font-medium tabular-nums text-zinc-200">{n}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Next email</h2>
          <Link href="/review" className="text-sm font-medium text-rose-300 hover:underline">Review all drafts</Link>
        </div>
        {preview ? (
          <div className="space-y-3">
            <div className="text-sm">
              <div className="text-zinc-500">To: {preview.to}</div>
              <div className="mt-0.5 font-semibold">{preview.subject}</div>
            </div>
            <EmailPreview html={preview.html} text={preview.text} isHtmlTemplate={preview.isHtmlTemplate} height={460} />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No contacts waiting. Ask an admin to assign you more.</p>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          <Button variant="secondary" disabled={busy !== null} onClick={() => act('test')}>
            {busy === 'test' ? 'Sending…' : 'Send test to me'}
          </Button>
          <Button disabled={busy !== null || !stats.pending && !user.paused} onClick={() => act('start')}>
            {busy === 'start' ? 'Starting…' : user.paused ? 'Resume sending' : 'Start sending'}
          </Button>
          <Button variant="danger" disabled={busy !== null || user.paused} onClick={() => act('pause')}>
            Pause
          </Button>
        </div>
        <p className="text-xs text-zinc-500">Emails go out 8am–7pm Central, about 165 an hour, with a short random gap between each.</p>
      </Card>
    </div>
  );
}
