import Link from 'next/link';
import { OrganizerPanel } from '@/components/OrganizerPanel';
import { SignInButton, SignOutButton } from '@/components/SignInButton';
import { Card, Notice } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: PageProps<'/'>) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const denied = params.error !== undefined;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Reach</h1>
        {user && (
          <div className="flex items-center gap-3">
            {user.role === 'ADMIN' && (
              <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">
                Admin
              </Link>
            )}
            <SignOutButton />
          </div>
        )}
      </header>

      {user ? (
        <OrganizerPanel />
      ) : (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">HackUTD outreach, from your own inbox</h2>
          <p className="text-sm text-slate-600">Sign in with your @hackutd.co account to get started.</p>
          {denied && <Notice tone="red">That account isn&apos;t allowed. Use your @hackutd.co account and ask an admin to invite you.</Notice>}
          <SignInButton />
        </Card>
      )}
    </main>
  );
}
