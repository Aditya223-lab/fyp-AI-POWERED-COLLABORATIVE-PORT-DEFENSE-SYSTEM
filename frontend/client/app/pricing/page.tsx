'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { toast } from 'react-hot-toast';

const features = {
  free: [
    'Real-time threat dashboard',
    'Personal user profile',
    'Federated learning visibility',
    'Read-only access to live event stream',
  ],
  premium: [
    'Everything in Free',
    'Full attack stream + filters',
    'Severity analytics breakdown',
    'World threat map',
    'Priority alerts',
    'Cancel anytime',
  ],
};

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const lockedPage = params.get('locked');
  const [submitting, setSubmitting] = useState(false);

  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from('.price-card', {
        y: 30,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: 'power3.out',
      });
    },
    { scope: root },
  );

  async function startEsewaCheckout() {
    if (status !== 'authenticated') {
      signIn(undefined, { callbackUrl: '/pricing' });
      return;
    }
    setSubmitting(true);
    try {
      // The server decides the price and signs the payload; we just relay it
      // to eSewa as a form POST (ePay v2 requires a browser form submit).
      const res = await fetch('/api/payment/esewa/initiate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.action || !data.fields) {
        toast.error(data.error || 'Could not start checkout');
        setSubmitting(false);
        return;
      }
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.action;
      Object.entries(data.fields as Record<string, string>).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      toast.error('Network error starting eSewa checkout');
      setSubmitting(false);
    }
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const isPremium = session?.user?.plan === 'premium' || session?.user?.role === 'admin';

  return (
    <div ref={root} className="container mx-auto px-6 py-12">
      <header className="text-center mb-10">
        <p className="text-xs uppercase tracking-widest text-accent-cyan font-medium">
          Pricing
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Defend more. <span className="text-gradient-animated">Pay less.</span>
        </h1>
        <p className="mt-3 text-white/60 max-w-xl mx-auto">
          Join the federation for free. Upgrade to Premium to unlock the live
          attack stream and severity analytics.
        </p>
        {lockedPage && (
          <div className="mt-4 inline-block px-3 py-1.5 rounded-full bg-accent-yellow/10 border border-accent-yellow/30 text-xs text-accent-yellow">
            🔒 <span className="font-mono">/{lockedPage}</span> requires Premium
          </div>
        )}
        {params.get('payment') === 'failed' && (
          <div className="mt-4 inline-block px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            Payment was cancelled or failed, you have not been charged.
          </div>
        )}
      </header>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <div className="price-card glass rounded-2xl p-8 flex flex-col">
          <p className="text-xs uppercase tracking-widest text-white/60">Free</p>
          <p className="mt-2 font-display text-4xl font-bold">NPR 0</p>
          <p className="text-sm text-white/50 mt-1">forever</p>
          <ul className="mt-6 space-y-2 text-sm flex-1">
            {features.free.map((f) => (
              <li key={f} className="flex gap-2 items-start">
                <span className="text-accent-green mt-0.5">✓</span>
                <span className="text-white/80">{f}</span>
              </li>
            ))}
          </ul>
          <button
            disabled
            className="mt-6 px-4 py-2.5 rounded-lg border border-white/15 text-white/50 text-sm"
          >
            {session ? 'Your current plan' : 'Sign up to start'}
          </button>
        </div>

        <div className="price-card relative rounded-2xl p-8 flex flex-col border border-accent-cyan/40 bg-gradient-to-br from-accent-cyan/10 via-transparent to-accent-purple/10">
          <span className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-accent-cyan to-accent-purple text-primary-dark text-[10px] font-bold uppercase tracking-wider">
            Recommended
          </span>
          <p className="text-xs uppercase tracking-widest text-accent-cyan font-medium">
            Premium
          </p>
          <p className="mt-2 font-display text-4xl font-bold">
            NPR 999 <span className="text-base text-white/50 font-normal">/ month</span>
          </p>
          <p className="text-sm text-white/50 mt-1">paid via eSewa</p>
          <ul className="mt-6 space-y-2 text-sm flex-1">
            {features.premium.map((f) => (
              <li key={f} className="flex gap-2 items-start">
                <span className="text-accent-cyan mt-0.5">✓</span>
                <span className="text-white/90">{f}</span>
              </li>
            ))}
          </ul>
          {isPremium ? (
            <button
              onClick={() => router.push('/attacks')}
              className="mt-6 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 transition"
            >
              You&apos;re Premium · Go to /attacks
            </button>
          ) : (
            <button
              onClick={startEsewaCheckout}
              disabled={submitting}
              className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              {submitting ? 'Starting checkout…' : 'Upgrade with eSewa'}
              <span aria-hidden>→</span>
            </button>
          )}
          <p className="mt-3 text-[11px] text-white/40">
            Sandbox checkout. No real charge in test mode.
          </p>
          {isDev && !isPremium && (
            <button
              onClick={() => router.push('/payment/mock-esewa?amount=999')}
              disabled={submitting}
              className="mt-3 w-full px-4 py-2 rounded-lg border border-dashed border-accent-yellow/40 text-accent-yellow/90 text-xs hover:bg-accent-yellow/5 transition disabled:opacity-60"
            >
              ⚡ Dev: pay via simulated eSewa page
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
