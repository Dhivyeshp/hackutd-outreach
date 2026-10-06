import { timingSafeEqual } from 'node:crypto';
import { getServerSession, type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { encryptSecret } from './crypto';
import { prisma } from './db';
import { HttpError } from './http';

const domain = () => (process.env.ALLOWED_DOMAIN ?? 'hackutd.co').toLowerCase();
const adminEmail = () => process.env.ADMIN_EMAIL?.toLowerCase();

const BASE_SCOPE = 'openid email profile';
const GMAIL_SCOPE = `${BASE_SCOPE} https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly`;

const google = (id: string, scope: string, offline: boolean) =>
  GoogleProvider({
    id,
    name: 'Google',
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    authorization: {
      params: { scope, hd: domain(), ...(offline ? { access_type: 'offline', prompt: 'consent' } : {}) },
    },
  });

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [google('google', BASE_SCOPE, false), google('gmail', GMAIL_SCOPE, true)],
  pages: { signIn: '/', error: '/' },
  callbacks: {
    async signIn({ account, profile }) {
      const email = profile?.email?.toLowerCase();
      const claims = profile as { email_verified?: boolean; hd?: string } | undefined;
      if (!email || claims?.email_verified !== true || email.split('@')[1] !== domain() || claims.hd?.toLowerCase() !== domain()) {
        return false;
      }

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user && email === adminEmail()) {
        user = await prisma.user.create({ data: { email, name: profile?.name ?? '', role: 'ADMIN' } });
      }
      if (!user || user.disabled) return false; // not invited, or offboarded
      if (email === adminEmail() && user.role !== 'ADMIN') {
        user = await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
      }

      const patch: {
        name?: string;
        encryptedRefreshToken?: string;
        gmailConnected?: boolean;
        paused?: boolean;
        pausedReason?: null;
      } = {};
      if (!user.name && profile?.name) patch.name = profile.name;
      const granted = account?.scope ?? '';
      const hasGmailScopes = granted.includes('gmail.send') && granted.includes('gmail.readonly');
      if (account?.provider === 'gmail' && account.refresh_token && hasGmailScopes) {
        patch.encryptedRefreshToken = encryptSecret(account.refresh_token);
        patch.gmailConnected = true;
        if (user.pausedReason === 'gmail auth expired') {
          patch.paused = false;
          patch.pausedReason = null;
        }
      }
      if (Object.keys(patch).length) await prisma.user.update({ where: { id: user.id }, data: patch });
      return true;
    },
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email.toLowerCase();
      return token;
    },
  },
};

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Current user from the DB: roles and pauses are always read fresh, never trusted from the token. */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  return user && !user.disabled ? user : null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Sign in required');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new HttpError(403, 'Admin only');
  return user;
}

/** Cron routes: bearer check against CRON_SECRET (timing-safe). */
export function requireCron(req: Request): void {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || given.length !== want.length || !timingSafeEqual(given, want)) {
    throw new HttpError(401, 'Unauthorized');
  }
}
