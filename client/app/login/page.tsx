'use client';

import { getProviders, getSession, signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

const DEST_LABEL: Record<string, string> = {
  '/admin': 'admin dashboard',
  '/attacks': 'live attack console',
  '/': 'dashboard',
};

// Admins land on the admin dashboard, premium customers on the attack
// console; everyone else goes wherever they were originally headed.
function destinationFor(
  role: string | undefined,
  plan: string | undefined,
  fallback: string,
): string {
  if (role === 'admin') return '/admin';
  if (plan === 'premium') return '/attacks';
  return fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, status } = useSession();
  const callbackUrl = params.get('callbackUrl') || '/';
  const errorParam = params.get('error');

  const [providers, setProviders] = useState<Record<string, unknown> | null>(null);
  const [email, setEmail] = useState('user@demo.com');
  const [password, setPassword] = useState('user123');
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<{ name: string; dest: string } | null>(null);
  const redirecting = useRef(false);

  useEffect(() => {
    getProviders().then((p) => setProviders((p as Record<string, unknown>) ?? {}));
  }, []);

  const hasGoogle = !!providers?.google;
  const hasGitHub = !!providers?.github;
  const hasOAuth = hasGoogle || hasGitHub;

  const root = useRef<HTMLDivElement>(null);

  // Already-signed-in users who land on /login get routed straight through.
  // Skipped once handleCreds owns the redirect, so the welcome card shows.
  useEffect(() => {
    if (redirecting.current) return;
    if (status === 'authenticated' && session?.user) {
      router.replace(
        destinationFor(session.user.role, session.user.plan, callbackUrl),
      );
    }
  }, [status, session, callbackUrl, router]);

  useEffect(() => {
    if (errorParam === 'admin-only') setErr('That page is admin-only. Sign in as an admin.');
    else if (errorParam === 'CredentialsSignin') setErr('Invalid email or password.');
    else if (errorParam) setErr(`Sign-in error: ${errorParam}`);
  }, [errorParam]);

  useGSAP(
    () => {
      gsap.from('.login-card', { y: 30, opacity: 0, duration: 0.7, ease: 'power3.out' });
      gsap.from('.login-row', { y: 12, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out', delay: 0.2 });
    },
    { scope: root },
  );

  async function handleCreds(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading('credentials');
    const res = await signIn('credentials', { email, password, redirect: false });

    if (res?.error || !res?.ok) {
      setLoading(null);
      setErr('Invalid email or password.');
      return;
    }

    // Pull the freshly-issued session so we can route by role/plan.
    const fresh = await getSession();
    const dest = destinationFor(
      fresh?.user?.role,
      fresh?.user?.plan,
      callbackUrl,
    );
    const name = fresh?.user?.name || fresh?.user?.email || 'Commander';

    // Take over the redirect (so the status effect doesn't pre-empt the
    // welcome card), then hard-navigate so middleware re-runs with the
    // session cookie set — a soft router push leaves the page frozen here.
    redirecting.current = true;
    setLoading(null);
    setWelcome({ name, dest });
    setTimeout(() => {
      window.location.href = dest;
    }, 1400);
  }

  return (
    <div ref={root} className="min-h-[80vh] grid place-items-center px-6 py-12">
      <div className="login-card w-full max-w-md glass rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
        <div className="relative">
          <p className="text-xs uppercase tracking-widest text-accent-cyan font-medium">
            Welcome back
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold">
            Sign in to <span className="text-gradient">PortDefense</span>
          </h1>

          {welcome ? (
            <div className="login-row mt-8 text-center">
              <div className="mx-auto w-14 h-14 rounded-full grid place-items-center bg-accent-green/15 border border-accent-green/40">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-accent-green"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold">
                Welcome back,{' '}
                <span className="text-gradient">{welcome.name}</span>
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Opening the {DEST_LABEL[welcome.dest] ?? 'dashboard'}…
              </p>
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-accent-cyan">
                <span className="w-2 h-2 rounded-full bg-accent-cyan animate-ping" />
                Redirecting
              </div>
            </div>
          ) : (
            <>
          {err && (
            <div className="login-row mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
              {err}
            </div>
          )}

          {hasOAuth && (
            <div className="login-row mt-6 grid gap-2">
              {hasGoogle && (
                <button
                  type="button"
                  disabled={!!loading}
                  onClick={() => {
                    setLoading('google');
                    signIn('google', { callbackUrl });
                  }}
                  className="flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-white/15 hover:bg-white/5 transition disabled:opacity-50"
                >
                  <GoogleIcon />
                  <span className="text-sm font-medium">
                    {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
                  </span>
                </button>
              )}
              {hasGitHub && (
                <button
                  type="button"
                  disabled={!!loading}
                  onClick={() => {
                    setLoading('github');
                    signIn('github', { callbackUrl });
                  }}
                  className="flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-white/15 hover:bg-white/5 transition disabled:opacity-50"
                >
                  <GitHubIcon />
                  <span className="text-sm font-medium">
                    {loading === 'github' ? 'Redirecting…' : 'Continue with GitHub'}
                  </span>
                </button>
              )}
            </div>
          )}

          {hasOAuth && (
            <div className="login-row my-6 flex items-center gap-3 text-xs text-white/40">
              <div className="flex-1 h-px bg-white/10" />
              <span>or use email</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}

          {!hasOAuth && providers !== null && (
            <p className="login-row mt-4 text-xs text-white/50">
              OAuth providers not configured. Add Google/GitHub keys to{' '}
              <span className="font-mono text-white/70">.env.local</span> to enable them.
            </p>
          )}

          <form onSubmit={handleCreds} className="login-row space-y-3">
            <div>
              <label className="text-xs text-white/60">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!!loading}
              className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading === 'credentials' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="login-row mt-6 p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 space-y-1">
            <p className="font-semibold text-white/80">Demo accounts</p>
            <p><span className="font-mono">admin@demo.com / admin123</span> — admin + premium</p>
            <p><span className="font-mono">pro@demo.com / pro123</span> — premium customer</p>
            <p><span className="font-mono">user@demo.com / user123</span> — free customer</p>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.22-4.74 3.22-8.32z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" fill="#34A853"/>
      <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A11 11 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.06c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.3-.52-1.48.11-3.08 0 0 .97-.31 3.17 1.18a11 11 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.6.23 2.78.11 3.08.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.4-5.25 5.69.41.35.78 1.04.78 2.1v3.11c0 .3.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
    </svg>
  );
}
