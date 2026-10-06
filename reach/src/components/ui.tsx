import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

type Variant = 'primary' | 'secondary' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

const tones = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-rose-100 text-rose-800',
  slate: 'bg-slate-100 text-slate-700',
};

export function Badge({ tone = 'slate', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Notice({ tone = 'amber', children }: { tone?: 'amber' | 'red' | 'green'; children: ReactNode }) {
  const cls = { amber: 'border-amber-300 bg-amber-50 text-amber-900', red: 'border-rose-300 bg-rose-50 text-rose-900', green: 'border-emerald-300 bg-emerald-50 text-emerald-900' }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';
