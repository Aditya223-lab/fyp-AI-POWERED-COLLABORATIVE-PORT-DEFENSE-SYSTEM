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

  async function startKhaltiCheckout() {
    if (status !== 'authenticated') {
      signIn(undefined, { callbackUrl: '/pricing' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/payment/khalti/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 99900 }),
      });
      const data = await res.json();
      if (!res.ok || !data.payment_url) {
        if (data.error === 'khalti_not_configured') {
          toast.error('Khalti not configured. Add KHALTI_SECRET_KEY to .env.local.');
        } else {
          toast.error(data.error || 'Could not start checkout');
        }
        setSubmitting(false);
        return;
      }
      window.location.href = data.payment_url;
    } catch (e) {
      toast.error('Network error starting Khalti checkout');
      setSubmitting(false);
    }
  }

  const isPremium = session?.user?.plan === 'premium' || session?.user?.role === 'admin';

  return (
    <div ref={root} className="container mx-auto px-6 py-12">
      <header className="text-center mb-10">
        <p className="text-xs uppercase tracking-widest text-accent-cyan font-medium">
          Pricing
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Defend more. <span className="text-gradient">Pay less.</span>
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
          <p className="text-sm text-white/50 mt-1">paid via Khalti</p>
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
              You're Premium · Go to /attacks
            </button>
          ) : (
            <button
              onClick={startKhaltiCheckout}
              disabled={submitting}
              className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              {submitting ? 'Starting checkout…' : 'Upgrade with Khalti'}
              <span aria-hidden>→</span>
            </button>
          )}
          <p className="mt-3 text-[11px] text-white/40">
            Sandbox checkout. No real charge in test mode.
          </p>
        </div>
      </div>
    </div>
  );
}
