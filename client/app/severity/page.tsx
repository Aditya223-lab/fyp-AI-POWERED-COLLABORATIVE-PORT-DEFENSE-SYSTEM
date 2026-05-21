'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { severityColor } from '@/lib/mock';
import { orgAPI, threatAPI } from '@/lib/api';
import type { Severity, ThreatStatistics } from '@/types';

const order: Severity[] = ['low', 'medium', 'high', 'critical'];

export default function SeverityPage() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? null;
  const isAdmin = session?.user?.role === 'admin';

  const [stats, setStats] = useState<ThreatStatistics | null>(null);
  const [timeframe, setTimeframe] = useState<'hour' | 'day' | 'week'>('day');
  const [error, setError] = useState<string | null>(null);
  // For non-admin (premium) users we have to know which orgs are theirs
  // before we can ask the backend for scoped stats.
  const [myOrgIds, setMyOrgIds] = useState<string[] | null>(isAdmin ? [] : null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAdmin || !email) return;
    let cancelled = false;
    orgAPI
      .byOwner(email)
      .then((xs) => {
        if (!cancelled) setMyOrgIds(xs.map((o) => o.id));
      })
      .catch(() => {
        if (!cancelled) setMyOrgIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, email]);

  useEffect(() => {
    if (myOrgIds === null) return; // wait for org list (non-admin)
    let cancelled = false;
    setError(null);
    const promise = isAdmin
      ? threatAPI.statistics(timeframe)
      : myOrgIds.length === 0
        ? Promise.resolve<ThreatStatistics>({
            total: 0,
            bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
            byType: { syn: 0, udp: 0, connect: 0, fin: 0, null: 0, xmas: 0, ack: 0 },
            byHour: new Array(24).fill(0),
            trend: 'stable',
            averageSeverity: 0,
            zeroDayCount: 0,
          })
        : threatAPI.statistics(timeframe, myOrgIds);
    promise
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [timeframe, isAdmin, myOrgIds]);

  const counts: Record<Severity, number> = {
    low: stats?.bySeverity?.low ?? 0,
    medium: stats?.bySeverity?.medium ?? 0,
    high: stats?.bySeverity?.high ?? 0,
    critical: stats?.bySeverity?.critical ?? 0,
  };

  const max = Math.max(...Object.values(counts), 1);

  useGSAP(
    () => {
      gsap.from('.sev-bar', {
        scaleX: 0,
        transformOrigin: 'left',
        duration: 1.1,
        stagger: 0.1,
        ease: 'power3.out',
      });
      gsap.from('.sev-num', {
        textContent: 0,
        duration: 1.2,
        snap: { textContent: 1 },
        stagger: 0.1,
        ease: 'power2.out',
      });
    },
    { scope: root, dependencies: [stats] },
  );

  return (
    <div ref={root} className="container mx-auto px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent-purple font-medium">
            Risk analytics
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">
            Severity <span className="text-gradient">Breakdown</span>
          </h1>
          <p className="mt-3 text-white/60 max-w-2xl">
            Live distribution from the Spring backend. Critical and zero-day
            events propagate to all federation members in under one second.
          </p>
          {!isAdmin && myOrgIds !== null && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 text-xs text-accent-cyan">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
              Scoped to your {myOrgIds.length} organization
              {myOrgIds.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
          {(['hour', 'day', 'week'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 text-xs uppercase tracking-wider transition ${
                timeframe === t
                  ? 'bg-accent-cyan/20 text-white'
                  : 'text-white/60 hover:bg-white/5'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
          Backend unreachable: <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-lg">
              Severity Distribution
            </h3>
            <span className="text-xs text-white/50">
              {stats ? `${stats.total} total · trend: ${stats.trend}` : 'loading…'}
            </span>
          </div>
          <div className="space-y-5">
            {order.map((s) => (
              <div key={s}>
                <div className="flex justify-between text-sm mb-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${severityColor[s]}`}
                  >
                    {s}
                  </span>
                  <span className="font-mono text-white/80 sev-num">
                    {counts[s]}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`sev-bar h-full rounded-full ${
                      s === 'critical'
                        ? 'bg-gradient-to-r from-red-500 to-red-400'
                        : s === 'high'
                          ? 'bg-gradient-to-r from-orange-500 to-orange-400'
                          : s === 'medium'
                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    }`}
                    style={{ width: `${(counts[s] / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 grid gap-4">
          {order.map((s) => (
            <div
              key={s}
              className={`rounded-2xl p-5 border bg-gradient-to-br ${
                s === 'critical'
                  ? 'from-red-500/20 to-red-500/5 border-red-500/30'
                  : s === 'high'
                    ? 'from-orange-500/20 to-orange-500/5 border-orange-500/30'
                    : s === 'medium'
                      ? 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30'
                      : 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30'
              }`}
            >
              <p className="text-xs uppercase tracking-widest text-white/60">
                {s}
              </p>
              <p className="font-display text-3xl font-bold mt-1 sev-num">
                {counts[s]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
