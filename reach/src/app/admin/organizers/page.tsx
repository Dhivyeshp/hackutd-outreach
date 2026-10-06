'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Badge, Button, Card, Notice, inputCls } from '@/components/ui';
import { api } from '@/lib/client-api';

interface Org {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'ORGANIZER';
  gmailConnected: boolean;
  dailyCap: number;
  rampEnabled: boolean;
  paused: boolean;
  pausedReason: string | null;
  timezone: string;
  disabled: boolean;
  senderTitle: string;
}

export default function OrganizersPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setOrgs(await api<Org[]>('/api/admin/organizers'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, fields: Partial<Pick<Org, 'role' | 'paused' | 'rampEnabled' | 'dailyCap' | 'timezone' | 'disabled' | 'senderTitle'>>) {
    setError('');
    try {
      await api('/api/admin/organizers', { method: 'PATCH', body: { id, ...fields } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/admin/organizers', { body: { email } });
      setEmail('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      {error && <Notice tone="red">{error}</Notice>}
      <Card>
        <form onSubmit={invite} className="flex flex-wrap gap-3">
          <input className={`${inputCls} max-w-sm`} type="email" required placeholder="name@acmutd.co" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit">Invite organizer</Button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">They can sign in once invited. Only @acmutd.co accounts are accepted.</p>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {['User', 'Role', 'Title in emails', 'Gmail', 'Daily cap', 'Ramp', 'Sending', 'Access'].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {orgs.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-medium">
                  {o.name || '(not signed in yet)'}
                  <div className="text-xs font-normal text-zinc-500">{o.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select className={inputCls} value={o.role} onChange={(e) => patch(o.id, { role: e.target.value as Org['role'] })}>
                    <option value="ORGANIZER">Organizer</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    className={`${inputCls} w-44`}
                    defaultValue={o.senderTitle}
                    maxLength={80}
                    onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== o.senderTitle && patch(o.id, { senderTitle: e.target.value.trim() })}
                  />
                </td>
                <td className="px-4 py-3">{o.gmailConnected ? <Badge tone="green">Connected</Badge> : <Badge>Not connected</Badge>}</td>
                <td className="px-4 py-3">
                  <input
                    className={`${inputCls} w-24`}
                    type="number"
                    min={0}
                    max={1500}
                    defaultValue={o.dailyCap}
                    onBlur={(e) => Number(e.target.value) !== o.dailyCap && patch(o.id, { dailyCap: Number(e.target.value) })}
                  />
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={o.rampEnabled} onChange={(e) => patch(o.id, { rampEnabled: e.target.checked })} />
                </td>
                <td className="px-4 py-3">
                  {o.paused ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="amber">{o.pausedReason ?? 'Paused'}</Badge>
                      <Button variant="secondary" onClick={() => patch(o.id, { paused: false })}>
                        Unpause
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => patch(o.id, { paused: true })}>
                      Pause
                    </Button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant={o.disabled ? 'secondary' : 'danger'}
                    onClick={() => (o.disabled || window.confirm(`Disable ${o.email}? This revokes their stored Gmail access.`)) && patch(o.id, { disabled: !o.disabled })}
                  >
                    {o.disabled ? 'Re-enable' : 'Disable'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
