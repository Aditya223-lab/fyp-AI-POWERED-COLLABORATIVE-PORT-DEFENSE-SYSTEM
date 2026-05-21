'use client';
//attack page which is the live feed of all the threats detected across the federation, with filters for severity and IP/port search, and a global map visualization of attack origins and targets. It uses server-sent events for real-time updates and GSAP for animations.
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { severityColor } from '@/lib/mock';
import TopAttackers from '@/components/TopAttackers';
import { dashboardAPI, orgAPI } from '@/lib/api';
import { useThreatStream } from '@/hooks/useThreatStream';
import type { Severity, ThreatEvent } from '@/types';

const AttackMap = dynamic(() => import('@/components/AttackMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] rounded-2xl border border-white/10 bg-primary-dark/40 grid place-items-center text-white/30 text-sm">
      Loading global threat map…
    </div>
  ),
});

const severities: (Severity | 'all')[] = ['all', 'low', 'medium', 'high', 'critical'];

export default function AttacksPage() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? null;
  const isAdmin = session?.user?.role === 'admin';

  const { threats: streamThreats, status, eventCount } = useThreatStream(60);
  const [seeded, setSeeded] = useState<ThreatEvent[]>([]);
  const [seedReady, setSeedReady] = useState(false);
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [ipQuery, setIpQuery] = useState('');
  const [myOrgIds, setMyOrgIds] = useState<Set<string> | null>(
    isAdmin ? new Set() : null,
  );
  const root = useRef<HTMLDivElement>(null);

  // Preload the last 60 threats from the DB so the map has markers
  // immediately on first paint, instead of waiting ~3s per SSE tick.
  useEffect(() => {
    let cancelled = false;
    dashboardAPI
      .recentThreats(60)
      .then((xs) => {
        if (!cancelled) setSeeded(xs);
      })
      .catch(() => {
        /* swallow — stream will fill in eventually */
      })
      .finally(() => {
        if (!cancelled) setSeedReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live stream is the source of truth for fresh data. Backfill any seeded
  // threats that aren't already represented, then keep the most recent 60.
  const threats = useMemo(() => {
    if (streamThreats.length === 0) return seeded;
    const seen = new Set(streamThreats.map((t) => t.id));
    const backfill = seeded.filter((t) => !seen.has(t.id));
    return [...streamThreats, ...backfill].slice(0, 60);
  }, [streamThreats, seeded]);

  useEffect(() => {
    if (isAdmin || !email) return;
    let cancelled = false;
    orgAPI
      .byOwner(email)
      .then((xs) => {
        if (!cancelled) setMyOrgIds(new Set(xs.map((o) => o.id)));
      })
      .catch(() => {
        if (!cancelled) setMyOrgIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, email]);

  // Apply scope first (admin → all, premium → only their orgs), then severity.
  const scoped = useMemo(() => {
    if (isAdmin) return threats;
    if (myOrgIds === null) return [];
    return threats.filter((t) => myOrgIds.has(t.organizationId));
  }, [threats, isAdmin, myOrgIds]);

  const filtered = useMemo(() => {
    let out = scoped;
    if (filter !== 'all') out = out.filter((t) => t.severity === filter);
    const q = ipQuery.trim();
    if (q) {
      out = out.filter(
        (t) =>
          t.sourceIP.includes(q) ||
          String(t.targetPort).includes(q),
      );
    }
    return out;
  }, [scoped, filter, ipQuery]);

  // Animate on initial mount and on filter change ONLY. Previously this
  // depended on scoped.length, which ticks every ~3s when a new threat
  // streams in — that re-ran gsap.from() on every card, resetting them all
  // to opacity:0 and re-staggering 60 cards every few seconds. Result: the
  // grid looked stuck "loading" forever. New threats now just appear in
  // place via React; existing cards are never touched again.
  // fromTo + clearProps ensures an interrupted animation can't leave cards
  // permanently invisible (same fix we applied to .org-row and the hero).
  useGSAP(
    () => {
      gsap.fromTo(
        '.attack-card',
        { y: 16, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.02,
          duration: 0.35,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        },
      );
    },
    { scope: root, dependencies: [filter] },
  );

  return (
    <div ref={root} className="container mx-auto px-6 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-accent-cyan font-medium">
          Live monitor
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Attack <span className="text-gradient">Stream</span>
        </h1>
        <p className="mt-3 text-white/60 max-w-2xl">
          Every threat the AI classifies across the federation — port scans,
          DoS, brute-force and more. Filter by severity to triage incidents.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isAdmin && myOrgIds !== null && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 text-xs text-accent-cyan">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
              Scoped to your {myOrgIds.size} organization
              {myOrgIds.size === 1 ? '' : 's'}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs ${
              status === 'open'
                ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
                : status === 'connecting'
                  ? 'border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === 'open' ? 'bg-accent-green animate-pulse' : 'bg-current'
              }`}
            />
            {status === 'open'
              ? `${eventCount} live · ${scoped.length} on map`
              : status === 'connecting'
                ? 'connecting…'
                : 'stream offline'}
          </span>
        </div>
      </header>

      <div className="mb-6">
        <AttackMap threats={filtered} />
      </div>

      {/* IP search + severity filters in one bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <input
            value={ipQuery}
            onChange={(e) => setIpQuery(e.target.value)}
            placeholder="Search by source IP or port (e.g. 203.0.113 or 22)"
            className="w-full pl-9 pr-9 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm font-mono"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">
            ⌕
          </span>
          {ipQuery && (
            <button
              onClick={() => setIpQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs"
              aria-label="Clear IP filter"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {severities.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 text-xs rounded-lg border transition ${
                filter === s
                  ? 'bg-accent-cyan/20 border-accent-cyan/50 text-white'
                  : 'border-white/10 text-white/60 hover:bg-white/5'
              }`}
            >
              {s.toUpperCase()}
              {s !== 'all' && (
                <span className="ml-2 text-[10px] text-white/50">
                  {scoped.filter((t) => t.severity === s).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!isAdmin && myOrgIds !== null && myOrgIds.size === 0 && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-200">
          You don&apos;t own any organizations yet. Ask your admin to assign
          one from <code className="font-mono">/admin</code>.
        </div>
      )}

      {filtered.length === 0 &&
        seedReady &&
        (isAdmin || (myOrgIds && myOrgIds.size > 0)) && (
          <div className="mb-6 px-4 py-3 rounded-lg border border-white/10 bg-white/[0.02] text-sm text-white/60">
            No matching events in the live window yet.
          </div>
        )}

      {/* 2/3 cards + 1/3 Top Attackers sidebar on desktop */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4 content-start">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="attack-card glass rounded-xl p-5 card-hover"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${severityColor[t.severity]}`}
                  >
                    {t.severity}
                  </span>
                  {t.attackType && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30">
                      {t.attackType}
                    </span>
                  )}
                </div>
                {t.isZeroDay && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-accent-purple/20 text-accent-purple border border-accent-purple/30">
                    ZERO-DAY
                  </span>
                )}
              </div>
              <div className="font-mono text-sm">
                <button
                  onClick={() => setIpQuery(t.sourceIP)}
                  className="text-white hover:text-accent-cyan transition"
                  title="Click to filter by this IP"
                >
                  {t.sourceIP}
                </button>
                <span className="text-white/40 mx-2">→</span>
                <span className="text-accent-cyan">:{t.targetPort}</span>
              </div>
              <div className="text-xs text-white/50 mt-2">
                {t.targetService} · {t.scanType.toUpperCase()} scan
                {t.location?.city && (
                  <span className="text-white/40"> · {t.location.city}</span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/60 truncate">
                  {t.organizationName}
                </span>
                <span className="font-mono text-white/40 shrink-0 ml-2">
                  {Math.round(t.confidence * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <TopAttackers
              threats={scoped}
              selectedIp={ipQuery}
              onSelect={setIpQuery}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
