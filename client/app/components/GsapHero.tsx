'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

export default function GsapHero() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-pill', { y: 20, opacity: 0, duration: 0.6 })
        .from(
          '.hero-line',
          { y: 40, opacity: 0, duration: 0.9, stagger: 0.12 },
          '-=0.3',
        )
        .from(
          '.hero-sub',
          { y: 20, opacity: 0, duration: 0.7 },
          '-=0.4',
        )
        .from(
          '.hero-cta',
          { y: 20, opacity: 0, duration: 0.6, stagger: 0.1 },
          '-=0.4',
        );
    },
    { scope: root },
  );

  return (
    <div ref={root} className="max-w-2xl">
      <span className="hero-pill inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
        Federated learning live · 12 orgs online
      </span>

      <h1 className="mt-6 font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
        <span className="hero-line block">AI-Powered</span>
        <span className="hero-line block text-gradient">Collaborative</span>
        <span className="hero-line block">Port Defense</span>
      </h1>

      <p className="hero-sub mt-6 text-lg text-white/70 leading-relaxed">
        Detect port scans in real time, share anonymized threat intelligence
        across organizations, and learn from every attack — without ever
        exposing your raw data.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="/attacks"
          className="hero-cta inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 transition glow"
        >
          View Live Attacks
          <span aria-hidden>→</span>
        </a>
        <a
          href="/severity"
          className="hero-cta inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/15 text-white font-semibold hover:bg-white/5 transition"
        >
          Severity Analytics
        </a>
      </div>
    </div>
  );
}
