'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

// DEV-ONLY simulated eSewa checkout. Styled to resemble the real eSewa ePay
// page so the Premium upgrade demos cleanly when eSewa's UAT sandbox is down
// (captcha hangs / "service currently unavailable"). It calls the same
// /api/payment/esewa/dev-complete endpoint (which 404s in production), so no
// real payment is ever made and nothing here works in a production build.

const ESEWA_GREEN = '#60BB46';
const ESEWA_GREEN_DARK = '#3F9E2C';

// eSewa's published sandbox test wallet.
const TEST_ID = '9806800001';
const TEST_PASSWORD = 'Nepal@123';

function EsewaLogo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <div
        className="grid place-items-center rounded-lg font-bold text-white"
        style={{ background: ESEWA_GREEN, width: 34, height: 34 }}
      >
        e
      </div>
      <span className="text-2xl font-bold tracking-tight">
        <span style={{ color: ESEWA_GREEN }}>eSewa</span>
      </span>
    </div>
  );
}

export default function MockEsewaPage() {
  const router = useRouter();
  const params = useSearchParams();

  const amount = Number(params.get('amount') || 999);

  const [step, setStep] = useState<'login' | 'review'>('login');
  const [esewaId, setEsewaId] = useState(TEST_ID);
  const [password, setPassword] = useState(TEST_PASSWORD);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!esewaId.trim() || !password) {
      setError('Please enter your eSewa ID and password.');
      return;
    }
    // Accept the published sandbox wallet; anything else is rejected like the
    // real login would, to keep the demo believable.
    if (esewaId.trim() !== TEST_ID || password !== TEST_PASSWORD) {
      setError('Invalid eSewa ID or password.');
      return;
    }
    setStep('review');
  }

  function handlePay() {
    // The callback page owns the actual upgrade + demo-org provisioning
    // (?dev=1), so both the real eSewa flow and this simulation share one path.
    setBusy(true);
    setError('');
    router.push('/payment/callback?dev=1');
  }

  return (
    <div className="min-h-screen w-full bg-[#f3f4f6] text-slate-800 flex flex-col">
      {/* Simulation banner, honesty marker; also mirrors eSewa's sandbox notice */}
      <div className="w-full bg-amber-100 text-amber-800 text-center text-xs py-1.5 border-b border-amber-200">
        SIMULATION · eSewa test sandbox · no real payment is processed
      </div>

      {/* Header bar */}
      <header
        className="w-full py-3 px-4 sm:px-8 flex items-center justify-between shadow-sm"
        style={{ background: 'white', borderBottom: `3px solid ${ESEWA_GREEN}` }}
      >
        <EsewaLogo />
        <span className="text-xs text-slate-500">Secure Checkout 🔒</span>
      </header>

      <main className="flex-1 grid place-items-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Merchant / amount summary */}
          <div className="bg-white rounded-t-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">
                  Paying to
                </p>
                <p className="font-semibold text-slate-700">Port Defense System</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">
                  Amount
                </p>
                <p className="text-2xl font-bold" style={{ color: ESEWA_GREEN_DARK }}>
                  NPR {amount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Body card */}
          <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6 shadow-sm">
            {step === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <h1 className="text-lg font-semibold text-slate-700">
                  Login to your eSewa
                </h1>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    eSewa ID (Mobile Number)
                  </label>
                  <input
                    value={esewaId}
                    onChange={(e) => setEsewaId(e.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#60BB46] focus:ring-2 focus:ring-[#60BB46]/20"
                    placeholder="98XXXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Password / MPIN
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#60BB46] focus:ring-2 focus:ring-[#60BB46]/20"
                    placeholder="Password"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-lg font-semibold text-white transition hover:opacity-90"
                  style={{ background: ESEWA_GREEN }}
                >
                  LOGIN
                </button>

                <p className="text-[11px] text-slate-400 text-center">
                  Sandbox wallet · ID{' '}
                  <span className="font-mono text-slate-500">{TEST_ID}</span> ·
                  password <span className="font-mono text-slate-500">Nepal@123</span>
                </p>
              </form>
            ) : (
              <div className="space-y-5">
                <h1 className="text-lg font-semibold text-slate-700">
                  Confirm your payment
                </h1>

                <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
                  <Row label="eSewa ID" value={esewaId} />
                  <Row label="Merchant" value="Port Defense System" />
                  <Row label="Product" value="Premium (monthly)" />
                  <Row
                    label="Total"
                    value={`NPR ${amount.toLocaleString()}`}
                    bold
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  onClick={handlePay}
                  disabled={busy}
                  className="w-full py-3 rounded-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  style={{ background: ESEWA_GREEN }}
                >
                  {busy ? 'Processing…' : `PAY NPR ${amount.toLocaleString()}`}
                </button>
                <button
                  onClick={() => router.push('/pricing?payment=failed')}
                  disabled={busy}
                  className="w-full py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-slate-400 mt-4">
            © eSewa · This is a simulated checkout for demonstration only.
          </p>
        </div>
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? 'font-bold text-slate-800' : 'text-slate-700'}>
        {value}
      </span>
    </div>
  );
}
