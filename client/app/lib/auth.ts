import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import jwt from 'jsonwebtoken';
import { getUserPlan, setUserPlan } from '@/lib/userStore';
import type { Role } from '@/types/next-auth';

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function roleFor(email: string | null | undefined): Role {
  if (!email) return 'customer';
  return adminEmails.includes(email.toLowerCase()) ? 'admin' : 'customer';
}

const demoUsers: { email: string; password: string; name: string; plan: 'free' | 'premium' }[] = [
  { email: 'admin@demo.com', password: 'admin123', name: 'Demo Admin', plan: 'premium' },
  { email: 'pro@demo.com', password: 'pro123', name: 'Demo Pro User', plan: 'premium' },
  { email: 'user@demo.com', password: 'user123', name: 'Demo User', plan: 'free' },
];

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Demo Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(creds) {
      const u = demoUsers.find(
        (x) =>
          x.email === creds?.email?.toLowerCase() && x.password === creds?.password,
      );
      if (!u) return null;
      // Seed plan for demo users on first sign-in so their badge is correct.
      if (getUserPlan(u.email) !== u.plan) setUserPlan(u.email, u.plan);
      return { id: u.email, email: u.email, name: u.name };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  );
}

const BACKEND_JWT_TTL_SECONDS = 30 * 60;

function mintBackendToken(email: string, frontendRole: Role, plan: 'free' | 'premium'): string {
  const secret = process.env.APP_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'APP_JWT_SECRET missing or shorter than 32 chars. Set it in .env.local; it must match the backend app.jwt.secret.',
    );
  }
  // Spring's filter uppercases the role and prefixes ROLE_, so emit the
  // backend's canonical names: ADMIN for admins, USER for everyone else.
  const backendRole = frontendRole === 'admin' ? 'ADMIN' : 'USER';
  return jwt.sign({ role: backendRole, plan }, secret, {
    subject: email,
    algorithm: 'HS256',
    expiresIn: BACKEND_JWT_TTL_SECONDS,
  });
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user, trigger }) {
      const email = (user?.email ?? token.email) as string | undefined;
      token.role = roleFor(email);
      token.plan = getUserPlan(email);

      // Mint a fresh backend JWT on sign-in OR when the cached one is within
      // 5 minutes of expiry. Avoids re-signing on every session ping.
      const nowSec = Math.floor(Date.now() / 1000);
      const expiring = !token.backendTokenExp || token.backendTokenExp - nowSec < 300;
      if (email && (trigger === 'signIn' || trigger === 'signUp' || expiring)) {
        try {
          token.backendToken = mintBackendToken(email, token.role, token.plan);
          token.backendTokenExp = nowSec + BACKEND_JWT_TTL_SECONDS;
        } catch (err) {
          // Surfacing this in server logs is enough; the API client falls back
          // to unauthenticated requests (which 401 on protected paths).
          console.error('[auth] backend JWT mint failed:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? token.email ?? '') as string;
        session.user.role = token.role;
        session.user.plan = token.plan;
      }
      session.accessToken = token.backendToken;
      session.accessTokenExp = token.backendTokenExp;
      return session;
    },
  },
};

export { demoUsers };
