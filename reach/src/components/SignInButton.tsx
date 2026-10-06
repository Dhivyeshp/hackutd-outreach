'use client';

import { signIn, signOut } from 'next-auth/react';
import { Button } from './ui';

export function SignInButton() {
  return <Button onClick={() => signIn('google')}>Sign in with Google</Button>;
}

export function ConnectGmailButton() {
  return <Button onClick={() => signIn('gmail')}>Connect Gmail</Button>;
}

export function SignOutButton() {
  return (
    <Button variant="secondary" onClick={() => signOut({ callbackUrl: '/' })}>
      Sign out
    </Button>
  );
}
