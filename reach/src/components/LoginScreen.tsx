import { Brand } from './Brand';
import { SignInButton } from './SignInButton';
import { Notice } from './ui';

const FEATURES = ['Sends from your own inbox', 'Built-in safety limits', 'Replies tracked for you'];

export function LoginScreen({ denied }: { denied: boolean }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="animate-fade-up w-full max-w-sm space-y-8 text-center">
        <Brand size="lg" />

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Send the <span className="text-spark">signal.</span>
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400">Personal outreach from your own @acmutd.co inbox.</p>
        </div>

        <div className="glass space-y-4 rounded-2xl p-5">
          {denied && (
            <Notice tone="red">That account isn&apos;t allowed. Use your @acmutd.co account and ask an admin to invite you.</Notice>
          )}
          <SignInButton />
          <p className="text-xs text-zinc-500">Only invited @acmutd.co accounts can sign in.</p>
        </div>

        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-rose-400" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
