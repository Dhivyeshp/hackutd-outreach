import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const tabs = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/organizers', label: 'Organizers' },
  { href: '/admin/import', label: 'Contacts' },
  { href: '/admin/template', label: 'Template' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/');

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Reach admin</h1>
        <nav className="flex gap-1 rounded-xl bg-white p-1 text-sm font-semibold shadow-sm ring-1 ring-slate-200">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100">
              {t.label}
            </Link>
          ))}
          <Link href="/" className="rounded-lg px-3 py-1.5 text-indigo-600 hover:bg-indigo-50">
            My outreach
          </Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
