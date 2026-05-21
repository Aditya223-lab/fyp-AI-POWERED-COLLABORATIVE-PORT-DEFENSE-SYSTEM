'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Footer only makes sense on public-facing / user pages. Admin tooling, the
// payment redirect target, and the bare login screen shouldn't carry it.
const HIDE_ON_PREFIX = ['/login', '/payment', '/admin'];

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/attacks', label: 'Attacks' },
  { href: '/severity', label: 'Severity' },
  { href: '/user', label: 'My Operations' },
  { href: '/pricing', label: 'Pricing' },
];

export default function Footer() {
  const pathname = usePathname();
  if (HIDE_ON_PREFIX.some((p) => pathname?.startsWith(p))) return null;

  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/10 bg-primary-dark/40 backdrop-blur-md">
      <div className="container mx-auto px-6 py-10 grid gap-8 md:grid-cols-3">
        {/* Brand */}
        <div>
          <Link href="/" className="flex items-center gap-3 group">
            <span className="relative inline-flex">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-cyan animate-ping absolute opacity-75" />
              <span className="w-2.5 h-2.5 rounded-full bg-accent-cyan" />
            </span>
            <span className="font-display font-bold tracking-tight text-lg">
              <span className="text-gradient">PortDefense</span>
              <span className="text-white/50 font-medium ml-1">.ai</span>
            </span>
          </Link>
          <p className="mt-3 text-sm text-white/55 max-w-xs leading-relaxed">
            AI-powered collaborative port defense. Federated threat
            intelligence, zero raw-data exposure.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-3">
            Navigate
          </p>
          <ul className="space-y-2 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-white/70 hover:text-accent-cyan transition"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Project context */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-3">
            Project
          </p>
          <dl className="space-y-2 text-sm">
            <Row k="Build" v="Final Year Project" />
            <Row k="Stack" v="Next.js · Spring Boot · H2" />
            <Row k="Realtime" v="SSE + STOMP" />
            <Row k="License" v="Academic use" />
          </dl>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="container mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/40">
          <span>
            © {year} PortDefense.ai · Federated maritime defense research
          </span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            <span>System nominal</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-white/50">{k}</dt>
      <dd className="text-white/75 text-right">{v}</dd>
    </div>
  );
}
