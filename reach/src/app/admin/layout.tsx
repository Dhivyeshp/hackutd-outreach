import { redirect } from 'next/navigation';
import { Shell, type NavItem } from '@/components/Shell';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const nav: NavItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/organizers', label: 'Organizers' },
  { href: '/admin/import', label: 'Contacts' },
  { href: '/admin/template', label: 'Template' },
  { href: '/', label: 'My outreach' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/');

  return (
    <Shell title="Admin" userName={user.name || user.email} nav={nav}>
      {children}
    </Shell>
  );
}
