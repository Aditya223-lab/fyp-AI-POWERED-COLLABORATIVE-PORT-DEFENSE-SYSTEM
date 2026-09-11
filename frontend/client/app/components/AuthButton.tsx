'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';

const planBadge: Record<string, string> = {
  admin: 'bg-accent-purple/20 text-accent-purple border-accent-purple/40',
  premium: 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40',
  free: 'bg-white/10 text-white/60 border-white/20',
};

export default function AuthButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === 'loading') {
    return <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn()}
        className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 transition"
      >
        Sign in
      </button>
    );
  }

  const { name, email, image, role, plan } = session.user;
  const badge = role === 'admin' ? 'admin' : plan;
  const initial = (name || email || '?').slice(0, 1).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-white/10 hover:bg-white/5 transition"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="w-7 h-7 rounded-full"
          />
        ) : (
          <span className="w-7 h-7 rounded-full grid place-items-center bg-gradient-to-br from-accent-cyan to-accent-purple text-primary-dark text-xs font-bold">
            {initial}
          </span>
        )}
        <span
          className={`hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${planBadge[badge]}`}
        >
          {badge}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 z-50 rounded-xl border border-white/10 bg-primary-dark/95 backdrop-blur-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <p className="text-sm font-semibold truncate">{name || 'User'}</p>
              <p className="text-xs text-white/50 truncate">{email}</p>
              <div className="mt-2 flex items-center gap-2 text-[10px]">
                <span
                  className={`px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${planBadge[role === 'admin' ? 'admin' : 'free']}`}
                >
                  {role}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${planBadge[plan]}`}
                >
                  {plan}
                </span>
              </div>
            </div>
            <div className="py-1">
              <Link
                href="/user"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm hover:bg-white/5"
              >
                Profile
              </Link>
              {plan !== 'premium' && role !== 'admin' && (
                <Link
                  href="/pricing"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-accent-cyan hover:bg-white/5"
                >
                  Upgrade to Premium
                </Link>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: '/' });
                }}
                className="block w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
