'use client';
//attack page which is the live feed of all the threats detected across the federation, with filters for severity and IP/port search, and a global map visualization of attack origins and targets. It uses server-sent events for real-time updates and GSAP for animations.
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { severityColor } from '@/lib/mock';
import TopAttackers from '@/components/TopAttackers';
import { toast } from 'react-hot-toast';
import { dashboardAPI, orgAPI, responseAPI, targetAPI } from '@/lib/api';
import { useThreatStream } from '@/hooks/useThreatStream';
import type { MonitorTarget, Severity, ThreatEvent } from '@/types';

const AttackMap = dynamic(() => import('@/components/AttackMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] rounded-2xl border border-white/10 bg-primary-dark/40 grid place-items-center text-white/30 text-sm">
      Loading global threat map…
    </div>
  ),
});

const severities: (Severity | 'all')[] = ['all', 'low', 'medium', 'high', 'critical'];

// Filter pills tint to their severity when active, so triage reads at a glance.
const sevPillActive: Record<Severity | 'all', string> = {
  all: 'bg-accent-cyan/20 border-accent-cyan/50 text-white shadow-glow-cyan',
  low: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 shadow-glow-green',
  medium: 'bg-yellow-500/20 border-yellow-400/50 text-yellow-200 shadow-glow-yellow',
  high: 'bg-orange-500/20 border-orange-400/50 text-orange-200 shadow-glow-yellow',
  critical: 'bg-red-500/20 border-red-400/50 text-red-200 shadow-glow-red',
};

// Full literal class names so Tailwind's content scanner keeps them.
const sevCardClass: Record<Severity, string> = {
  low: 'sev-card-low',
  medium: 'sev-card-medium',
  high: 'sev-card-high',
  critical: 'sev-card-critical',
};

export default function AttacksPage() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? null;
  const isAdmin = session?.user?.role === 'admin';

  const { threats: streamThreats, status, eventCount } = useThreatStream(60);
  const [seeded, setSeeded] = useState<ThreatEvent[]>([]);
  const [seedReady, setSeedReady] = useState(false);
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [attackType, setAttackType] = useState<string>('all');
  const [ipQuery, setIpQuery] = useState('');
  const [myOrgIds, setMyOrgIds] = useState<Set<string> | null>(
    isAdmin ? new Set() : null,
  );
  // The assets this account registered for monitoring, so attacks can be tied
  // back to "my website" / "my server" rather than just an anonymous IP.
  const [myAssets, setMyAssets] = useState<MonitorTarget[]>([]);
  const [onlyMine, setOnlyMine] = useState(false);
  // IPs the admin has blocked this session, so cards can show "Blocked".
  const [blockedIps, setBlockedIps] = useState<Set<string>>(new Set());
  const [blocking, setBlocking] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Preload existing blocks so a page reload still shows what's blocked.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    responseAPI
      .blocks()
      .then((xs) => {
        if (!cancelled) {
          setBlockedIps(
            new Set(xs.filter((b) => b.status === 'ACTIVE').map((b) => b.ipAddress)),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function blockIp(t: ThreatEvent) {
    setBlocking(t.sourceIP);
    try {
      const b = await responseAPI.block({
        ip: t.sourceIP,
        reason: `${t.attackType ?? 'attack'} on port ${t.targetPort}`,
        source: 'THREAT',
        organizationId: t.organizationId,
      });
      setBlockedIps((prev) => new Set([...prev, b.ipAddress]));
      toast[b.enforcement === 'ENFORCED' ? 'success' : 'error'](
        b.enforcement === 'ENFORCED'
          ? `Firewall now blocks ${b.ipAddress}`
          : `Recorded (not enforced): ${b.detail ?? 'run backend as admin'}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'block failed');
    } finally {
      setBlocking(null);
    }
  }

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
        /* swallow, stream will fill in eventually */
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

  // Monitored assets: admins see every registered asset, a customer sees their
  // own plus the shared demo ones. Refreshed periodically because a website's
  // IP changes whenever its DNS answer does.
  useEffect(() => {
    if (!isAdmin && !email) return;
    let cancelled = false;
    const load = () =>
      targetAPI
        .all(isAdmin ? undefined : email)
        .then((xs) => {
          if (!cancelled) setMyAssets(xs);
        })
        .catch(() => {
          /* attacks still render without asset labels */
        });
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAdmin, email]);

  // Every IP that belongs to one of my assets → the asset's name. A website
  // contributes each address its DNS name currently resolves to.
  const assetIps = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of myAssets) {
      if (a.ipAddress) map.set(a.ipAddress, a.name);
      for (const ip of (a.resolvedIps ?? '').split(',')) {
        const trimmed = ip.trim();
        if (trimmed) map.set(trimmed, a.name);
      }
    }
    return map;
  }, [myAssets]);

  // Which of my assets this threat involves — as a victim, or as the source
  // when one of my own hosts is the one attacking.
  const assetFor = useMemo(
    () => (t: ThreatEvent) =>
      (t.targetIp ? assetIps.get(t.targetIp) : undefined) ??
      assetIps.get(t.sourceIP),
    [assetIps],
  );

  // Apply scope first, then severity. A customer sees threats belonging to
  // their organizations *and* anything touching an asset they registered —
  // otherwise an attack on your own server could be filtered out just because
  // the ingest assigned it to a different org.
  const scoped = useMemo(() => {
    if (isAdmin) return threats;
    if (myOrgIds === null) return [];
    return threats.filter(
      (t) => myOrgIds.has(t.organizationId) || assetFor(t) !== undefined,
    );
  }, [threats, isAdmin, myOrgIds, assetFor]);

  // Distinct attack types present in the current data, for the type filter
  // bar. Computed from the data (not hard-coded) so it adapts to whatever the
  // AI model actually classified.
  const attackTypes = useMemo(() => {
    const set = new Set<string>();
    for (const t of scoped) if (t.attackType) set.add(t.attackType);
    return ['all', ...Array.from(set).sort()];
  }, [scoped]);

  const filtered = useMemo(() => {
    let out = scoped;
    if (onlyMine) out = out.filter((t) => assetFor(t) !== undefined);
    if (filter !== 'all') out = out.filter((t) => t.severity === filter);
    if (attackType !== 'all')
      out = out.filter((t) => t.attackType === attackType);
    const q = ipQuery.trim();
    if (q) {
      out = out.filter(
        (t) =>
          t.sourceIP.includes(q) ||
          (t.targetIp?.includes(q) ?? false) ||
          String(t.targetPort).includes(q),
      );
    }
    return out;
  }, [scoped, onlyMine, assetFor, filter, attackType, ipQuery]);

  // Animate on initial mount and on filter change ONLY. Previously this
  // depended on scoped.length, which ticks every ~3s when a new threat
  // streams in, that re-ran gsap.from() on every card, resetting them all
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
    { scope: root, dependencies: [filter, attackType] },
  );

  return (
    <div ref={root} className="container mx-auto px-6 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-accent-cyan font-medium">
          Live monitor
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">
          Attack <span className="text-gradient-animated">Stream</span>
        </h1>
        <p className="mt-3 text-white/60 max-w-2xl">
          Every threat the AI classifies across the federation  port scans,
          DoS, brute-force and more. Filter by severity to triage incidents.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isAdmin && myOrgIds !== null && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 text-xs text-accent-cyan">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
              Scoped to your {myOrgIds.size} organization
              {myOrgIds.size === 1 ? '' : 's'}
              {myAssets.length > 0 &&
                ` + ${myAssets.length} monitored asset${myAssets.length === 1 ? '' : 's'}`}
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

      {/* The assets this account monitors, with the attacks currently hitting
          each one. Clicking a pill filters the stream down to that IP. */}
      {myAssets.length > 0 && (
        <div className="mb-6 glass rounded-2xl px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h3 className="font-display font-semibold text-sm">
                {isAdmin ? 'Monitored assets' : 'My monitored assets'}
              </h3>
              <p className="text-[11px] text-white/40 mt-0.5">
                Registered IPs and the websites they resolve to. Click one to
                filter the stream to it.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="accent-accent-cyan"
              />
              Only attacks on my assets
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {myAssets.map((a) => {
              const ips = [
                a.ipAddress,
                ...(a.resolvedIps ?? '').split(','),
              ]
                .map((s) => s.trim())
                .filter(Boolean);
              const unique = Array.from(new Set(ips));
              const hits = scoped.filter(
                (t) =>
                  (t.targetIp && unique.includes(t.targetIp)) ||
                  unique.includes(t.sourceIP),
              ).length;
              const active = unique.includes(ipQuery.trim());
              return (
                <button
                  key={a.id}
                  onClick={() => setIpQuery(active ? '' : (unique[0] ?? ''))}
                  disabled={unique.length === 0}
                  title={
                    unique.length > 1
                      ? `Also resolves to ${unique.slice(1).join(', ')}`
                      : undefined
                  }
                  className={`px-3 py-2 rounded-lg border text-left transition disabled:opacity-40 ${
                    active
                      ? 'bg-accent-cyan/20 border-accent-cyan/50 text-white'
                      : 'border-white/10 text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        a.status === 'UP'
                          ? 'bg-accent-green'
                          : a.status === 'DEGRADED'
                            ? 'bg-accent-yellow'
                            : a.status === 'DOWN'
                              ? 'bg-red-400'
                              : 'bg-white/30'
                      }`}
                    />
                    {a.type === 'WEBSITE' ? '🌐' : '🖥️'} {a.name}
                    {hits > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-200 border border-red-400/40">
                        {hits}
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] font-mono text-white/45 mt-0.5">
                    {unique[0] ?? 'resolving…'}
                    {unique.length > 1 && ` +${unique.length - 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-6">
        <AttackMap threats={filtered} />
      </div>

      {/* IP search + severity filters in one bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <input
            value={ipQuery}
            onChange={(e) => setIpQuery(e.target.value)}
            placeholder="Search by source IP, target IP or port (e.g. 203.0.113 or 22)"
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
                  ? sevPillActive[s]
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

      {/* Attack-type filter, one button per attack family the AI classified */}
      {attackTypes.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-white/40 mr-1">
            Attack type
          </span>
          {attackTypes.map((a) => (
            <button
              key={a}
              onClick={() => setAttackType(a)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                attackType === a
                  ? 'bg-accent-purple/20 border-accent-purple/50 text-white'
                  : 'border-white/10 text-white/60 hover:bg-white/5'
              }`}
            >
              {a === 'all' ? 'ALL' : a}
              {a !== 'all' && (
                <span className="ml-2 text-[10px] text-white/50">
                  {scoped.filter((t) => t.attackType === a).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

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
          {filtered.map((t) => {
            const asset = assetFor(t);
            const outbound = asset !== undefined && assetIps.has(t.sourceIP);
            return (
            <div
              key={t.id}
              className={`attack-card glass rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 ${sevCardClass[t.severity]} ${
                asset ? 'ring-1 ring-accent-cyan/40' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${severityColor[t.severity]}`}
                  >
                    {t.severity}
                  </span>
                  {asset && (
                    <span
                      className="text-[10px] font-semibold px-2 py-1 rounded bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40"
                      title={
                        outbound
                          ? 'This attack came FROM one of your monitored assets'
                          : 'This attack targeted one of your monitored assets'
                      }
                    >
                      {outbound ? '↗ from' : '🎯'} {asset}
                    </span>
                  )}
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
                {t.targetIp ? (
                  <button
                    onClick={() => setIpQuery(t.targetIp!)}
                    className="text-accent-cyan hover:text-white transition"
                    title="Click to filter by the attacked asset"
                  >
                    {t.targetIp}:{t.targetPort}
                  </button>
                ) : (
                  <span className="text-accent-cyan">:{t.targetPort}</span>
                )}
              </div>
              <div className="text-xs text-white/50 mt-2">
                {t.targetService} · {t.scanType.toUpperCase()} scan
                {t.location?.city && (
                  <span className="text-white/40"> · {t.location.city}</span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs gap-3">
                <span className="text-white/60 truncate">
                  {t.organizationName}
                </span>
                <span
                  className="flex items-center gap-1.5 shrink-0"
                  title="AI confidence"
                >
                  <span className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-purple"
                      style={{ width: `${Math.round(t.confidence * 100)}%` }}
                    />
                  </span>
                  <span className="font-mono text-white/50">
                    {Math.round(t.confidence * 100)}%
                  </span>
                </span>
              </div>
              {/* Active response — admins can block the attacker IP at the host
                  firewall. Outbound attacks are from your own asset, so blocking
                  the source there would be wrong; offer it only for inbound. */}
              {isAdmin && !outbound && (
                <div className="mt-2">
                  {blockedIps.has(t.sourceIP) ? (
                    <span className="text-[11px] text-red-300/80 flex items-center gap-1">
                      🛡️ {t.sourceIP} blocked
                    </span>
                  ) : (
                    <button
                      onClick={() => blockIp(t)}
                      disabled={blocking === t.sourceIP}
                      className="text-[11px] text-white/50 hover:text-red-300 disabled:opacity-50"
                      title="Add a firewall rule on this machine dropping this IP"
                    >
                      {blocking === t.sourceIP ? 'Blocking…' : `⛔ Block ${t.sourceIP}`}
                    </button>
                  )}
                </div>
              )}
            </div>
            );
          })}
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
