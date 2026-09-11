'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { orgAPI } from '@/lib/api';

type State =
  | { kind: 'verifying' }
  | { kind: 'success'; transactionId?: string; amount?: number }
  | { kind: 'failed'; status: string; message?: string };

export default function PaymentCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: session, update, status } = useSession();
  const [state, setState] = useState<State>({ kind: 'verifying' });

  // eSewa redirects back with ?data=<base64 payload>. The simulated checkout
  // redirects here with ?dev=1 (the upgrade is applied server-side either way).
  const esewaData = params.get('data');
  const isDev = params.get('dev') === '1';
  const email = session?.user?.email;

  useEffect(() => {
    // Wait for the session to resolve so we have the email for provisioning.
    if (status === 'loading') return;

    let cancelled = false;

    // Give the freshly-upgraded customer a personal demo org so /attacks shows
    // data immediately. Best-effort: if it fails, the live stream still fills
    // their view over time, so we never block the success screen on it.
    async function provisionDemoOrg() {
      if (!email) return;
      try {
        await orgAPI.provisionDemo(email);
      } catch {
        /* non-fatal */
      }
    }

    async function succeed(transactionId?: string, amount?: number) {
      await provisionDemoOrg();
      if (cancelled) return;
      setState({ kind: 'success', transactionId, amount });
      update(); // re-read the session so the plan badge / gating updates
    }

    async function runDevUpgrade() {
      try {
        const res = await fetch('/api/payment/esewa/dev-complete', { method: 'POST' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setState({ kind: 'failed', status: data.error ?? 'dev_upgrade_failed' });
          return;
        }
        await succeed(data.transaction_id, data.amount);
      } catch {
        if (!cancelled) {
          setState({
            kind: 'failed',
            status: 'network_error',
            message: 'Network error during upgrade.',
          });
        }
      }
    }

    async function verifyEsewa(dataB64: string) {
      try {
        const res = await fetch('/api/payment/esewa/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: dataB64 }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          await succeed(data.transaction_id, data.amount);
        } else {
          setState({
            kind: 'failed',
            status: data.status ?? data.error ?? 'Unknown',
            message: data.error,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            kind: 'failed',
            status: 'network_error',
            message: 'Network error during verification.',
          });
        }
      }
    }

    if (isDev) {
      runDevUpgrade();
    } else if (esewaData) {
      verifyEsewa(esewaData);
    } else {
      setState({ kind: 'failed', status: 'missing_payment_id', message: 'No payment data in URL.' });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="min-h-[70vh] grid place-items-center px-6 py-12">
      <div className="w-full max-w-md glass rounded-2xl p-8 text-center">
        {state.kind === 'verifying' && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
            <h1 className="mt-5 font-display text-2xl font-bold">Verifying payment…</h1>
            <p className="mt-2 text-sm text-white/60">
              Confirming with eSewa. This usually takes a second.
            </p>
          </>
        )}

        {state.kind === 'success' && (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-accent-green/20 grid place-items-center text-accent-green text-3xl">
              ✓
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold">Welcome to Premium</h1>
            <p className="mt-2 text-sm text-white/60">
              Payment verified. /attacks and /severity are now unlocked, and your
              organization is already collecting live attacks.
            </p>
            {state.transactionId && (
              <p className="mt-3 text-xs font-mono text-white/40 break-all">
                txn {state.transactionId}
              </p>
            )}
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={() => router.push('/attacks')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold text-sm"
              >
                Go to Attacks
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 rounded-lg border border-white/15 text-sm hover:bg-white/5"
              >
                Dashboard
              </button>
            </div>
          </>
        )}

        {state.kind === 'failed' && (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-red-500/20 grid place-items-center text-red-400 text-3xl">
              ✕
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold">Payment not verified</h1>
            <p className="mt-2 text-sm text-white/60">
              Status: <span className="font-mono">{state.status}</span>
            </p>
            {state.message && (
              <p className="mt-1 text-xs text-white/40">{state.message}</p>
            )}
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={() => router.push('/pricing')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold text-sm"
              >
                Try again
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 rounded-lg border border-white/15 text-sm hover:bg-white/5"
              >
                Back to dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
