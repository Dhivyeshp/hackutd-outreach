import { LoginScreen } from '@/components/LoginScreen';
import { OrganizerPanel } from '@/components/OrganizerPanel';
import { Shell, type NavItem } from '@/components/Shell';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: PageProps<'/'>) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user) return <LoginScreen denied={params.error !== undefined} />;

  const nav: NavItem[] = [
    { href: '/', label: 'Outreach' },
    { href: '/review', label: 'Review drafts' },
  ];
  if (user.role === 'ADMIN') nav.push({ href: '/admin', label: 'Admin' });

  return (
    <Shell title="Outreach" userName={user.name || user.email} nav={nav}>
      <OrganizerPanel />
    </Shell>
  );
}
