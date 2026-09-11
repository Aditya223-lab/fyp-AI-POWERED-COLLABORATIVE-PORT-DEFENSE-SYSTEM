'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

// The 3D scene is client-only and heavy, load it lazily so the landing
// paints instantly. No backend data is used anywhere on this page, so it
// renders fine even when Spring isn't running.
const SceneShield = dynamic(() => import('@/components/SceneShield'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center text-white/30 text-sm">
      Initializing defense grid…
    </div>
  ),
});

const FEATURES = [
  {
    icon: '◈',
    title: 'AI Threat Detection',
    body: 'A RandomForest model trained on the CICIDS2017 dataset classifies every scan, port scan, DoS, brute-force, botnet, in real time.',
    color: 'text-accent-green border-accent-green/30 from-accent-green/15 to-emerald-500/5',
  },
  {
    icon: '◇',
    title: 'Collaborative Defense',
    body: 'Multiple organisations share one live battlespace, seeing threats across the whole federation the instant they happen.',
    color: 'text-accent-cyan border-accent-cyan/30 from-accent-cyan/15 to-accent-blue/5',
  },
  {
    icon: '◍',
    title: 'Privacy-Preserving',
    body: 'Federated learning aggregates encrypted gradients, raw traffic data never leaves your own network.',
    color: 'text-accent-purple border-accent-purple/30 from-accent-purple/15 to-pink-500/5',
  },
];

export default function HomeLanding() {
  return (
    <div className="relative overflow-hidden">
      {/* Layered background: cyber grid + slow radar sweep + scanline. All
          pointer-events:none so they don't steal clicks. */}
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[120vmax] h-[120vmax] radar-sweep opacity-60 pointer-events-none"
        aria-hidden
      />
      <div className="absolute inset-0 scanline opacity-40 pointer-events-none" />

      {/* Hero */}
      <section className="container mx-auto px-6 pt-10 pb-16 relative">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
              AI-Powered Collaborative Port Defense
            </span>

            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
              <span className="glitch block" data-text="Decentralized AI.">
                Decentralized AI.
              </span>
              <span className="block text-gradient-animated mt-1">
                Unified Naval Shield.
              </span>
            </h1>

            <p className="mt-6 text-lg text-white/70 leading-relaxed">
              Collaborate across fleets and ports. Our{' '}
              <span className="text-accent-cyan">Neural Threat Detection</span>{' '}
              engine classifies every attack in real time and shares it across
              the federation, zero latency, total awareness.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple bg-[length:200%_auto] hover:bg-right text-primary-dark font-semibold transition-all duration-500 glow hover:shadow-glow-purple hover:-translate-y-0.5"
              >
                Sign in
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-accent-purple/30 text-white font-semibold hover:bg-accent-purple/10 hover:border-accent-purple/50 hover:shadow-glow-purple transition-all duration-300"
              >
                View Pricing
              </Link>
              <Link
                href="/model"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/15 text-white/80 font-semibold hover:bg-white/5 hover:text-white transition-all duration-300"
              >
                See the AI Model
              </Link>
            </div>

            <p className="mt-6 text-[11px] text-white/40">
              Sign in to open your live threat dashboard. Demo accounts are on
              the login page.
            </p>
          </div>

          {/* 3D shield */}
          <div className="relative h-[420px] sm:h-[480px] lg:h-[520px] rounded-3xl overflow-hidden border border-accent-cyan/20 bg-primary-dark/40 ring-1 ring-accent-cyan/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_60%)] pointer-events-none" />
            <SceneShield />
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs pointer-events-none">
              <span className="px-2 py-1 rounded bg-black/40 backdrop-blur text-accent-cyan font-mono uppercase tracking-wider">
                ◉ Defense Grid
              </span>
              <span className="px-2 py-1 rounded bg-black/40 backdrop-blur text-white/60">
                drag to rotate
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="container mx-auto px-6 pb-20 relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 card-hover ${f.color}`}
            >
              <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
              <p className="text-2xl">{f.icon}</p>
              <h3 className="font-display font-semibold text-lg mt-3 text-white">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>

        {/* Call to action strip */}
        <div className="mt-10 glass rounded-2xl p-8 border border-accent-cyan/20 text-center">
          <h3 className="font-display font-bold text-2xl">
            Ready to defend the port of the future?
          </h3>
          <p className="mt-2 text-white/60 max-w-xl mx-auto">
            Sign in to watch live threats stream onto your dashboard, or explore
            the plans to unlock the full attack console.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link
              href="/login"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 transition"
            >
              Sign in
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 rounded-xl border border-white/15 text-white/80 font-semibold hover:bg-white/5 hover:text-white transition"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
