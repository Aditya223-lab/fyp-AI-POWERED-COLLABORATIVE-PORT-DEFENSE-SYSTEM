'use client';

import type { Severity, ThreatEvent } from '@/types';

interface Props {
  threats: ThreatEvent[];
  selectedIp: string;
  onSelect: (ip: string) => void;
}

// Country code → flag emoji. Each ASCII letter maps to a Regional Indicator
// Symbol (offset 0x1F1A5). 'NL' → 🇳🇱
function flag(cc?: string): string {
  if (!cc || cc.length !== 2) return '🌐';
  return String.fromCodePoint(
    ...cc
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1a5 + c.charCodeAt(0)),
  );
}

const sevColor: Record<Severity, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

interface IPStat {
  ip: string;
  count: number;
  country: string;
  city: string;
  sev: Record<Severity, number>;
}

export default function TopAttackers({ threats, selectedIp, onSelect }: Props) {
  // Aggregate the visible window by source IP.
  const stats = new Map<string, IPStat>();
  for (const t of threats) {
    const cur: IPStat = stats.get(t.sourceIP) ?? {
      ip: t.sourceIP,
      count: 0,
      country: t.location?.country ?? '',
      city: t.location?.city ?? '',
      sev: { low: 0, medium: 0, high: 0, critical: 0 },
    };
    cur.count++;
    cur.sev[t.severity]++;
    stats.set(t.sourceIP, cur);
  }
  const sorted = Array.from(stats.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <span className="text-accent-yellow">⚠</span> Top Attackers
        </h3>
        <p className="text-xs text-white/50 mt-0.5">
          Aggregated from the live window. Click a row to focus the map.
        </p>
      </div>

      {selectedIp && (
        <div className="px-5 py-2 bg-accent-cyan/10 border-b border-accent-cyan/30 flex items-center justify-between text-xs">
          <span className="text-accent-cyan font-mono">
            filter: {selectedIp}
          </span>
          <button
            onClick={() => onSelect('')}
            className="text-white/60 hover:text-white"
          >
            clear ✕
          </button>
        </div>
      )}

      <ul className="divide-y divide-white/5">
        {sorted.map((s) => {
          const active = s.ip === selectedIp;
          return (
            <li key={s.ip}>
              <button
                onClick={() => onSelect(active ? '' : s.ip)}
                className={`w-full text-left px-5 py-3 transition ${
                  active
                    ? 'bg-accent-cyan/10 border-l-2 border-accent-cyan'
                    : 'hover:bg-white/5 border-l-2 border-transparent'
                }`}
              >
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-mono text-xs text-white flex items-center gap-1.5 truncate">
                    <span className="text-base">{flag(s.country)}</span>
                    {s.ip}
                  </span>
                  <span className="font-mono text-xs text-accent-cyan font-bold shrink-0">
                    {s.count}
                  </span>
                </div>
                <div className="text-[10px] text-white/40 mt-1 truncate">
                  {s.city}
                  {s.country && ` · ${s.country}`}
                </div>
                <div className="mt-2 flex gap-0.5 h-1 rounded overflow-hidden">
                  {(['low', 'medium', 'high', 'critical'] as Severity[]).map(
                    (sev) => {
                      const v = s.sev[sev];
                      if (v === 0) return null;
                      return (
                        <span
                          key={sev}
                          className={`${sevColor[sev]} rounded-sm`}
                          style={{ width: `${(v / s.count) * 100}%` }}
                          title={`${sev}: ${v}`}
                        />
                      );
                    },
                  )}
                </div>
              </button>
            </li>
          );
        })}
        {sorted.length === 0 && (
          <li className="px-5 py-8 text-center text-xs text-white/40">
            No attackers in window yet.
          </li>
        )}
      </ul>
    </div>
  );
}
