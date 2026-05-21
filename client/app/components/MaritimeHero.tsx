'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

interface Props {
  orgCount?: number | null;
  threatLevel?: number; // 0-100 — drives the meter fill width
  collaborators?: { name: string; color: string }[];
}

const DEFAULT_COLLABORATORS = [
  { name: 'Alpha', color: 'from-accent-cyan to-accent-blue' },
  { name: 'Helix', color: 'from-emerald-400 to-emerald-600' },
  { name: 'Vertex', color: 'from-accent-purple to-pink-500' },
  { name: 'Orion', color: 'from-orange-400 to-red-500' },
];

export default function MaritimeHero({
  orgCount,
  threatLevel = 62,
  collaborators = DEFAULT_COLLABORATORS,
}: Props) {
  const root = useRef<HTMLDivElement>(null);

  // Entrance animation: runs ONCE on mount. Uses fromTo + clearProps so an
  // interrupted run can never leave text stuck at opacity:0 — that was the
  // bug where the left-side hero text disappeared.
  useGSAP(
    () => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out', clearProps: 'transform,opacity' },
      });
      tl.fromTo(
        '.hero-strip',
        { y: -16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.05 },
      )
        .fromTo(
          '.hero-avatar',
          { x: -30, opacity: 0 },
          { x: 0, opacity: 1, stagger: 0.08, duration: 0.5 },
          '-=0.3',
        )
        .fromTo(
          '.hero-line',
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, stagger: 0.1 },
          '-=0.2',
        )
        .fromTo(
          '.hero-sub',
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 },
          '-=0.3',
        )
        .fromTo(
          '.hero-cta',
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.08 },
          '-=0.3',
        );
    },
    { scope: root },
  );

  // Meter fill animates independently whenever threatLevel changes — keeping
  // it OUT of the entrance timeline means a late stats-fetch can't re-trigger
  // (and interrupt) the headline animation.
  useGSAP(
    () => {
      gsap.fromTo(
        '.meter-fill',
        { width: '0%' },
        {
          width: `${threatLevel}%`,
          duration: 1.4,
          delay: 0.6,
          ease: 'power3.out',
        },
      );
    },
    { scope: root, dependencies: [threatLevel] },
  );

  return (
    <div ref={root} className="max-w-2xl">
      {/* Top strip: threat level + collaborator avatars */}
      <div className="hero-strip flex items-center justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/50 mb-1.5">
            <span>Threat Level</span>
            <span className="font-mono text-accent-yellow">
              {threatLevel}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
            <div className="meter-fill h-full threat-meter rounded-full" />
          </div>
        </div>

        <div className="flex -space-x-2 shrink-0">
          {collaborators.map((c) => (
            <div
              key={c.name}
              className={`hero-avatar w-9 h-9 rounded-full border-2 border-primary-dark bg-gradient-to-br ${c.color} grid place-items-center text-[10px] font-bold text-primary-dark shadow-lg`}
              title={c.name}
              style={{ animation: 'float-y 4s ease-in-out infinite' }}
            >
              {c.name.slice(0, 2).toUpperCase()}
            </div>
          ))}
          <div className="hero-avatar w-9 h-9 rounded-full border-2 border-primary-dark bg-white/10 grid place-items-center text-[10px] font-bold text-white/70">
            +{Math.max(0, (orgCount ?? 12) - collaborators.length)}
          </div>
        </div>
      </div>

      <span className="hero-strip inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
        Federation live · {orgCount ?? '12'} orgs online
      </span>

      <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
        <span
          className="hero-line glitch block"
          data-text="Decentralized AI."
        >
          Decentralized AI.
        </span>
        <span className="hero-line block text-gradient mt-1">
          Unified Naval Shield.
        </span>
      </h1>

      <p className="hero-sub mt-6 text-lg text-white/70 leading-relaxed">
        Collaborate across fleets and ports. Our{' '}
        <span className="text-accent-cyan">Neural Threat Detection</span>{' '}
        engine fuses drone, radar and satellite data into a single holographic
        defense matrix. Zero latency. Total awareness.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/attacks"
          className="hero-cta inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 transition glow"
        >
          Join Defense Grid
          <span aria-hidden>→</span>
        </Link>
        <Link
          href="/severity"
          className="hero-cta inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition"
        >
          Severity Matrix
        </Link>
      </div>
    </div>
  );
}
