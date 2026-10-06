'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
import { ConnectGmailButton } from './SignInButton';
import { Badge, Button, Card, Notice, Stat } from './ui';

interface Data {
  user: { name: string; email: string; role: string; gmailConnected: boolean; paused: boolean; pausedReason: string | null };
  stats: { assigned: number; pending: number; queued: number; sent: number; replied: number; bounced: number; optedOut: number; sentLast24h: number };
  limits: { cap: number; remaining: number };
  globalPaused: string | null;
  preview: { to: string; subject: string; text: string } | null;
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

  if (!data) return <p className="text-slate-500">Loading…</p>;
  const { user, stats, limits, preview } = data;

  if (!user.gmailConnected) {
    return (
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Connect your Gmail</h2>
        <p className="text-sm text-slate-600">Reach sends from your own @acmutd.co inbox. One consent screen, nothing else to set up.</p>
        <ConnectGmailButton />
      </Card>
    );
  }

  const status = user.paused ? <Badge tone="amber">Paused{user.pausedReason ? `: ${user.pausedReason}` : ''}</Badge> : stats.queued ? <Badge tone="green">Sending</Badge> : <Badge>Idle</Badge>;

  return (
    <div className="space-y-5">
      {data.globalPaused && <Notice tone="red">All sending is paused by an admin: {data.globalPaused}</Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your outreach</h2>
          {status}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Assigned" value={stats.assigned} />
          <Stat label="Sent" value={stats.sent} hint={`${stats.sentLast24h} in last 24h`} />
          <Stat label="Replied" value={stats.replied} />
          <Stat label="Bounced" value={stats.bounced} />
          <Stat label="Pending" value={stats.pending} />
          <Stat label="Queued" value={stats.queued} />
          <Stat label="Opted out" value={stats.optedOut} />
          <Stat label="Left today" value={limits.remaining} hint={`of ${limits.cap}`} />
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Next email</h2>
        {preview ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="text-slate-500">To: {preview.to}</div>
            <div className="mt-1 font-semibold">{preview.subject}</div>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-slate-700">{preview.text}</pre>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No contacts waiting. Ask an admin to assign you more.</p>
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
        <p className="text-xs text-slate-500">Emails go out 8am–6pm Central, about 100 an hour, with a short random gap between each.</p>
      </Card>
    </div>
  );
}
