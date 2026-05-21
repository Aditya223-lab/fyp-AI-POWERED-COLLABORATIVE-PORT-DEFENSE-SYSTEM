'use client';

import { useEffect, useState } from 'react';
import { orgAPI } from '@/lib/api';
import type { Organization, Severity, SeverityCounts } from '@/types';

const ORDER: Severity[] = ['low', 'medium', 'high', 'critical'];

const SEV_STYLE: Record<Severity, string> = {
  low: 'from-emerald-500 to-emerald-400',
  medium: 'from-yellow-500 to-yellow-400',
  high: 'from-orange-500 to-orange-400',
  critical: 'from-red-500 to-red-400',
};

const SEV_TEXT: Record<Severity, string> = {
  low: 'text-emerald-300',
  medium: 'text-yellow-300',
  high: 'text-orange-300',
  critical: 'text-red-300',
};

interface Props {
  orgs: Organization[];
}

export default function SeverityByOrg({ orgs }: Props) {
  const [stats, setStats] = useState<Record<string, SeverityCounts>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orgs.length === 0) return;
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      const entries = await Promise.all(
        orgs.map((o) =>
          orgAPI
            .severityStats(o.id)
            .then((s) => [o.id, s] as const)
            .catch(() => [o.id, { low: 0, medium: 0, high: 0, critical: 0 }] as const),
        ),
      );
      if (cancelled) return;
      const next: Record<string, SeverityCounts> = {};
      for (const [id, s] of entries) next[id] = s;
      setStats(next);
      setLoading(false);
    }

    fetchAll();
    // Live-refresh so newly-detected threats and freshly-invited orgs both
    // surface without a manual page reload.
    const id = setInterval(fetchAll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orgs]);

  return (
    <div className="glass rounded-2xl overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold">
            Severity by Organization{' '}
            <span className="ml-1 text-xs text-white/40 font-normal">
              ({orgs.length} org{orgs.length === 1 ? '' : 's'})
            </span>
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            Live counts per member, refreshed every 8s. New orgs you invite
            appear here automatically.
          </p>
        </div>
        {loading && <span className="text-xs text-white/40">refreshing…</span>}
      </div>

      <div className="divide-y divide-white/5">
        {orgs.map((o) => {
          const s = stats[o.id] ?? { low: 0, medium: 0, high: 0, critical: 0 };
          const total = s.low + s.medium + s.high + s.critical;
          const max = Math.max(s.low, s.medium, s.high, s.critical, 1);
          return (
            <div key={o.id} className="px-6 py-4 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-12 sm:col-span-3">
                <p className="font-medium truncate">{o.name}</p>
                <p className="text-xs text-white/40 capitalize">
                  {o.industry} · {total} threats
                </p>
              </div>
              <div className="col-span-12 sm:col-span-9 grid grid-cols-4 gap-2">
                {ORDER.map((sev) => (
                  <div key={sev}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="uppercase text-white/50 tracking-wider">
                        {sev}
                      </span>
                      <span className={`font-mono ${SEV_TEXT[sev]}`}>
                        {s[sev]}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${SEV_STYLE[sev]} transition-all duration-500`}
                        style={{ width: `${(s[sev] / max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {orgs.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            No organizations to report on yet.
          </div>
        )}
      </div>
    </div>
  );
}
