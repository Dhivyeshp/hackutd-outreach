'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Notice } from '@/components/ui';
import { api } from '@/lib/client-api';

interface OrgStats {
  assigned: number;
  pending: number;
  queued: number;
  sent: number;
  replied: number;
  bounced: number;
  sentLast24h: number;
  bounceRate: number;
}
interface Data {
  organizers: { id: string; name: string; email: string; paused: boolean; pausedReason: string | null; gmailConnected: boolean; stats: OrgStats }[];
  quota: { used: number; pauseAt: number };
  global: { paused: boolean; reason: string };
  alerts: { id: string; createdAt: string; level: string; message: string }[];
  unassigned: number;
}

export default function AdminDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api<Data>('/api/admin/stats'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: 'pause_all' | 'resume_all' | 'resolve_alerts') {
    await api('/api/admin/stats', { body: { action } });
    await load();
  }

  if (error) return <Notice tone="red">{error}</Notice>;
  if (!data) return <p className="text-slate-500">Loading…</p>;
  const pct = Math.min(100, (data.quota.used / data.quota.pauseAt) * 100);
  const total = data.organizers.reduce(
    (a, o) => ({ sent: a.sent + o.stats.sent, replied: a.replied + o.stats.replied, bounced: a.bounced + o.stats.bounced, day: a.day + o.stats.sentLast24h }),
    { sent: 0, replied: 0, bounced: 0, day: 0 },
  );

  return (
    <div className="space-y-5">
      {data.global.paused && (
        <Notice tone="red">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>All sending paused: {data.global.reason || 'no reason recorded'}</span>
            <Button variant="danger" onClick={() => act('resume_all')}>
              Resume everyone
            </Button>
          </div>
        </Notice>
      )}
      {data.alerts.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Alerts</h2>
            <Button variant="secondary" onClick={() => act('resolve_alerts')}>
              Dismiss all
            </Button>
          </div>
          {data.alerts.map((a) => (
            <div key={a.id} className="flex gap-2 text-sm">
              <Badge tone={a.level === 'critical' ? 'red' : 'amber'}>{a.level}</Badge>
              <span>{a.message}</span>
              <span className="ml-auto text-slate-400">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Project quota today (estimated)</h2>
          <span className="text-sm text-slate-500">
            {data.quota.used.toLocaleString()} / {data.quota.pauseAt.toLocaleString()} units
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${pct > 80 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-slate-600">
          <span>{total.sent.toLocaleString()} sent</span>
          <span>{total.day.toLocaleString()} in last 24h</span>
          <span>{total.replied.toLocaleString()} replied</span>
          <span>{total.bounced.toLocaleString()} bounced</span>
          <span>{data.unassigned.toLocaleString()} unassigned</span>
        </div>
        {!data.global.paused && (
          <Button variant="danger" onClick={() => act('pause_all')}>
            Pause everyone
          </Button>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {['Organizer', 'Assigned', 'Sent', 'Replied', 'Bounced', 'Pending', '24h', 'Bounce %', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.organizers.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-medium">
                  {o.name}
                  <div className="text-xs font-normal text-slate-500">{o.email}</div>
                </td>
                <td className="px-4 py-3 tabular-nums">{o.stats.assigned}</td>
                <td className="px-4 py-3 tabular-nums">{o.stats.sent}</td>
                <td className="px-4 py-3 tabular-nums">{o.stats.replied}</td>
                <td className="px-4 py-3 tabular-nums">{o.stats.bounced}</td>
                <td className="px-4 py-3 tabular-nums">{o.stats.pending}</td>
                <td className="px-4 py-3 tabular-nums">{o.stats.sentLast24h}</td>
                <td className="px-4 py-3 tabular-nums">{(o.stats.bounceRate * 100).toFixed(1)}%</td>
                <td className="px-4 py-3">
                  {!o.gmailConnected ? <Badge tone="slate">No Gmail</Badge> : o.paused ? <Badge tone="amber">Paused</Badge> : o.stats.queued ? <Badge tone="green">Sending</Badge> : <Badge>Idle</Badge>}
                </td>
              </tr>
            ))}
            {!data.organizers.length && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  No organizers yet. Invite some on the Organizers tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
