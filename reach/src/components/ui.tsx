import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CountUp } from './CountUp';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`glass animate-fade-up rounded-2xl p-6 ${className}`}>{children}</section>;
}

type Variant = 'primary' | 'secondary' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'btn-spark text-white',
  secondary: 'border border-white/10 bg-white/5 text-zinc-200 hover:border-white/20 hover:bg-white/10',
  danger: 'border border-rose-500/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    />
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-4 py-3.5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{typeof value === 'number' ? <CountUp value={value} /> : value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      {label && <div className="flex justify-between text-xs text-zinc-400"><span>{label}</span><span>{Math.round(pct)}%</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500 transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const tones = {
  green: 'bg-emerald-500/15 text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-300',
  red: 'bg-rose-500/15 text-rose-300',
  slate: 'bg-white/10 text-zinc-300',
};

export function Badge({ tone = 'slate', live = false, children }: { tone?: keyof typeof tones; live?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {live && <span className="live-dot size-1.5 rounded-full bg-emerald-400" />}
      {children}
    </span>
  );
}

export function Notice({ tone = 'amber', children }: { tone?: 'amber' | 'red' | 'green'; children: ReactNode }) {
  const cls = {
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    red: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  }[tone];
  return <div className={`animate-fade-up rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-rose-400/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-rose-500/20';
