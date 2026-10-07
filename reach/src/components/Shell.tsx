'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { KindProvider, KindSwitch } from './KindContext';

export interface NavItem {
  href: string;
  label: string;
}

interface ShellProps {
  title: string;
  userName: string;
  nav: NavItem[];
  children: ReactNode;
}

export function Shell({ title, userName, nav, children }: ShellProps) {
  const pathname = usePathname();
  // Everything except the team list is split into faculty vs sponsors.
  const showKindSwitch = !pathname.startsWith('/admin/organizers');
  const isActive = (href: string) => (href === '/' || href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <KindProvider>
    <div className="relative min-h-screen text-zinc-100 md:flex">

      <aside className="sticky top-0 z-10 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-black/25 p-4 backdrop-blur-xl md:flex">
        <div className="px-2 py-3">
          <Brand />
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive(item.href) ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
              }`}
            >
              {isActive(item.href) && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gradient-to-b from-amber-400 to-fuchsia-500" />}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 text-sm font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="truncate text-sm font-medium">{userName}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl md:hidden">
        <Brand />
        <button onClick={() => signOut({ callbackUrl: '/' })} className="text-xs text-zinc-400">
          Sign out
        </button>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 md:hidden">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${isActive(item.href) ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="relative mx-auto w-full min-w-0 max-w-6xl flex-1 space-y-8 px-4 py-6 md:px-10 md:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="animate-fade-up text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {showKindSwitch && <KindSwitch />}
        </div>
        {children}
      </main>
    </div>
    </KindProvider>
  );
}
