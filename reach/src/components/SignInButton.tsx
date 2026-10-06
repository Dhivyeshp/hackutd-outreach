'use client';

import { signIn } from 'next-auth/react';
import { Button } from './ui';

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export function SignInButton() {
  return (
    <button
      onClick={() => signIn('google')}
      className="btn-spark flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold text-white"
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-white">
        <GoogleG />
      </span>
      Continue with Google
    </button>
  );
}

export function ConnectGmailButton() {
  return <Button onClick={() => signIn('gmail')}>Connect Gmail</Button>;
}
