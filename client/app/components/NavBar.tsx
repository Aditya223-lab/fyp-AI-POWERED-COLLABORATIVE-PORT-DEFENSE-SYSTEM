'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import AuthButton from './AuthButton';
import LiveIndicator from './LiveIndicator';

type LinkItem = {
  href: string;
  label: string;
  admin?: boolean;
  hideForPremium?: boolean;
};

const allLinks: LinkItem[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/attacks', label: 'Attacks' },
  { href: '/severity', label: 'Severity' },
  { href: '/model', label: 'AI Model' },
  { href: '/admin', label: 'Admin', admin: true },
  { href: '/user', label: 'User' },
  { href: '/contact', label: 'Contact' },
  { href: '/pricing', label: 'Pricing', hideForPremium: true },
];

export default function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const isPremium =
    session?.user?.role === 'admin' || session?.user?.plan === 'premium';

  const links = allLinks.filter((l) => {
    if (l.admin && session?.user?.role !== 'admin') return false;
    if (l.hideForPremium && isPremium) return false;
    return true;
  });

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <span className="relative inline-flex">
            <span className="w-3 h-3 rounded-full bg-accent-cyan animate-ping absolute opacity-75" />
            <span className="w-3 h-3 rounded-full bg-accent-cyan glow" />
          </span>
          <span className="font-display font-bold tracking-tight text-lg sm:text-xl">
            <span className="text-gradient">PortDefense</span>
            <span className="text-white/60 font-medium ml-2 hidden sm:inline">
              .ai
            </span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  active
                    ? 'text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {l.label}
                {active && (
                  <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple rounded-full" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <LiveIndicator />
          <AuthButton />
          <button
            onClick={() => setOpen((o) => !o)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5"
            aria-label="Toggle menu"
          >
            <div className="w-6 flex flex-col gap-1.5">
              <span
                className={`block h-0.5 bg-white transition-transform ${
                  open ? 'rotate-45 translate-y-2' : ''
                }`}
              />
              <span
                className={`block h-0.5 bg-white transition-opacity ${
                  open ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`block h-0.5 bg-white transition-transform ${
                  open ? '-rotate-45 -translate-y-2' : ''
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-white/10 bg-primary-dark/95 backdrop-blur-md">
          <div className="container mx-auto px-6 py-3 flex flex-col">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`py-3 text-sm font-medium ${
                    active ? 'text-accent-cyan' : 'text-white/70'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
