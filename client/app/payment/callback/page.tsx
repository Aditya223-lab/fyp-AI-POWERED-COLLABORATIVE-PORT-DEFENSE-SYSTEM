'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

type State =
  | { kind: 'verifying' }
  | { kind: 'success'; transactionId?: string; amount?: number }
  | { kind: 'failed'; status: string; message?: string };

export default function PaymentCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { update } = useSession();
  const [state, setState] = useState<State>({ kind: 'verifying' });

  const pidx = params.get('pidx');
  const khaltiStatus = params.get('status');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!pidx) {
        setState({ kind: 'failed', status: 'missing_pidx', message: 'No payment id in URL.' });
        return;
      }
      if (khaltiStatus && khaltiStatus !== 'Completed') {
        setState({
          kind: 'failed',
          status: khaltiStatus,
          message: `Khalti reported status: ${khaltiStatus}.`,
        });
        return;
      }
      try {
        const res = await fetch('/api/payment/khalti/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pidx }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setState({ kind: 'success', transactionId: data.transaction_id, amount: data.amount });
          // Force NextAuth to re-read the session so the plan badge updates.
          update();
        } else {
          setState({
            kind: 'failed',
            status: data.status ?? 'Unknown',
            message: data.error,
          });
        }
      } catch (e) {
        if (cancelled) return;
        setState({ kind: 'failed', status: 'network_error', message: 'Network error during verification.' });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [pidx, khaltiStatus, update]);

  return (
    <div className="min-h-[70vh] grid place-items-center px-6 py-12">
      <div className="w-full max-w-md glass rounded-2xl p-8 text-center">
        {state.kind === 'verifying' && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
            <h1 className="mt-5 font-display text-2xl font-bold">Verifying payment…</h1>
            <p className="mt-2 text-sm text-white/60">
              Confirming with Khalti. This usually takes a second.
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
              Payment verified. /attacks and /severity are now unlocked.
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
