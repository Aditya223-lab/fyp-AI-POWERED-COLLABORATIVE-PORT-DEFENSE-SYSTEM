'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import MaritimeHero from '@/components/MaritimeHero';
import ThreatList from '@/components/ThreatList';
import { dashboardAPI } from '@/lib/api';
import { useThreatStream } from '@/hooks/useThreatStream';
import type { DashboardStats } from '@/types';

const SceneShield = dynamic(() => import('@/components/SceneShield'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center text-white/30 text-sm">
      Initializing defense grid…
    </div>
  ),
});

export default function DashboardPage() {
  const { threats, status, eventCount } = useThreatStream(30);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    dashboardAPI
      .stats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((e: Error) => {
        if (!cancelled) setStatsError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Threat level: synthesize a 0-100 value from detection rate and active
  // threats so the meter actually means something.
  const threatLevel = stats
    ? Math.min(
        100,
        Math.round(stats.detectionRate * 0.4 + (stats.activeThreats ?? 0) * 1.5),
      )
    : 62;

  const trustScore = stats
    ? Math.max(0, Math.min(100, Math.round(100 - stats.falsePositiveRate)))
    : 94;

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

      <section className="container mx-auto px-6 pt-10 pb-16 relative">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <MaritimeHero
            orgCount={stats?.totalOrganizations}
            threatLevel={threatLevel}
          />
          <div className="relative h-[420px] sm:h-[480px] lg:h-[520px] rounded-3xl overflow-hidden border border-accent-cyan/20 bg-primary-dark/40 ring-1 ring-accent-cyan/10">
            {/* Subtle radial glow behind the 3D scene */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.15),transparent_60%)] pointer-events-none" />
            <SceneShield />
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs pointer-events-none">
              <span className="px-2 py-1 rounded bg-black/40 backdrop-blur text-accent-cyan font-mono uppercase tracking-wider">
                ◉ Live Mesh
              </span>
              <span className="px-2 py-1 rounded bg-black/40 backdrop-blur text-white/60">
                {stats ? `${stats.totalOrganizations} nodes` : 'syncing…'}
              </span>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white/50 pointer-events-none">
              <span className="px-2 py-1 rounded bg-black/30 backdrop-blur">
                Defense Matrix
              </span>
              <span className="px-2 py-1 rounded bg-black/30 backdrop-blur">
                drag to rotate
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Glassmorphic info cards: Trust Score, Collab Status, FL Round, Blurb */}
      <section className="container mx-auto px-6 pb-12 relative">
        {statsError && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
            Backend unreachable: <span className="font-mono">{statsError}</span>{' '}
            — make sure Spring is running on{' '}
            <span className="font-mono">http://localhost:8080</span>.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Trust Score */}
          <div className="relative overflow-hidden rounded-2xl border border-accent-green/30 bg-gradient-to-br from-accent-green/15 to-emerald-500/5 p-5 card-hover">
            <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
            <p className="text-[10px] uppercase tracking-widest text-accent-green font-bold">
              ◈ Trust Score
            </p>
            <p className="font-display text-4xl font-bold mt-2 text-white">
              {trustScore}
              <span className="text-white/40 text-xl">.0</span>
            </p>
            <p className="text-[11px] text-white/40 mt-1">
              Network confidence
            </p>
          </div>

          {/* Collab Status */}
          <div className="relative overflow-hidden rounded-2xl border border-accent-cyan/30 bg-gradient-to-br from-accent-cyan/15 to-accent-blue/5 p-5 card-hover">
            <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
            <p className="text-[10px] uppercase tracking-widest text-accent-cyan font-bold">
              ◇ Collab Status
            </p>
            <p className="font-display text-3xl font-bold mt-2 flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  status === 'open'
                    ? 'bg-accent-green animate-pulse'
                    : status === 'connecting'
                      ? 'bg-accent-yellow'
                      : 'bg-red-400'
                }`}
              />
              {status === 'open' ? 'ONLINE' : status.toUpperCase()}
            </p>
            <p className="text-[11px] text-white/40 mt-1">
              {status === 'open' ? `${eventCount} packets received` : 'standby'}
            </p>
          </div>

          {/* FL Round */}
          <div className="relative overflow-hidden rounded-2xl border border-accent-purple/30 bg-gradient-to-br from-accent-purple/15 to-pink-500/5 p-5 card-hover">
            <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
            <p className="text-[10px] uppercase tracking-widest text-accent-purple font-bold">
              ◍ FL Round
            </p>
            <p className="font-display text-4xl font-bold mt-2 text-white font-mono">
              #{stats?.federatedLearningRound ?? '—'}
            </p>
            <p className="text-[11px] text-white/40 mt-1">
              Encrypted gradients aggregating
            </p>
          </div>

          {/* Response time */}
          <div className="relative overflow-hidden rounded-2xl border border-accent-yellow/30 bg-gradient-to-br from-accent-yellow/15 to-orange-500/5 p-5 card-hover">
            <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
            <p className="text-[10px] uppercase tracking-widest text-accent-yellow font-bold">
              ⚡ Avg Response
            </p>
            <p className="font-display text-4xl font-bold mt-2 text-white">
              {stats?.averageResponseTime ?? '—'}
              <span className="text-white/40 text-xl ml-1">ms</span>
            </p>
            <p className="text-[11px] text-white/40 mt-1">
              Threat → mitigation
            </p>
          </div>
        </div>
      </section>

      {/* Battlespace blurb + live threat stream */}
      <section className="container mx-auto px-6 pb-16 relative">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ThreatList threats={threats} limit={10} />
          </div>

          <div className="space-y-4">
            <div className="glass rounded-2xl p-6 border border-accent-cyan/20">
              <p className="text-[10px] uppercase tracking-widest text-accent-cyan font-bold">
                Battlespace
              </p>
              <h3 className="font-display font-semibold text-lg mt-1">
                Port of the Future
              </h3>
              <p className="mt-3 text-sm text-white/70 leading-relaxed">
                The Port of the Future doesn&apos;t just watch the water; it{' '}
                <span className="text-accent-cyan">thinks with it</span>. 12 AI
                agents analyze 4 million data points per second, while your
                team collaborates inside a shared 3D battlespace. Stop threats
                before they breach the breakwater.
              </p>
            </div>

            <div className="glass rounded-2xl p-6 border border-white/10">
              <h3 className="font-display font-semibold text-lg mb-4">
                Federated Learning
              </h3>
              <div className="space-y-3 text-sm">
                <Row
                  label="Current Round"
                  value={`#${stats?.federatedLearningRound ?? '—'}`}
                  color="text-accent-cyan"
                />
                <Row
                  label="Model Accuracy"
                  value={stats ? `${Math.round(stats.detectionRate)}%` : '—'}
                  color="text-accent-green"
                />
                <Row
                  label="False Positives"
                  value={stats ? `${Math.round(stats.falsePositiveRate)}%` : '—'}
                  color="text-accent-yellow"
                />
                <Row
                  label="Collab Score"
                  value={stats ? `${Math.round(stats.collaborationScore)}/100` : '—'}
                  color="text-accent-purple"
                />
              </div>
              <p className="mt-4 pt-3 border-t border-white/10 text-[11px] text-white/40 leading-relaxed">
                Encrypted gradients aggregated every 6 minutes. Raw traffic
                data never leaves your network.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-white/60">{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  );
}
