import { redirect } from 'next/navigation';
import { DraftReview } from '@/components/DraftReview';
import { Shell, type NavItem } from '@/components/Shell';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');

  const nav: NavItem[] = [
    { href: '/', label: 'Outreach' },
    { href: '/review', label: 'Review drafts' },
  ];
  if (user.role === 'ADMIN') nav.push({ href: '/admin', label: 'Admin' });

  return (
    <Shell title="Review drafts" userName={user.name || user.email} nav={nav}>
      <DraftReview />
    </Shell>
  );
}
