'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';
import type { ThreatEvent } from '@/types';
import { severityColor } from '@/lib/mock';

interface Props {
  threats: ThreatEvent[];
  limit?: number;
}

function timeAgo(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ThreatList({ threats, limit = 8 }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from('.threat-row', {
        x: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.06,
        ease: 'power2.out',
        delay: 0.3,
      });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className="glass rounded-2xl p-6 overflow-hidden h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg">
          Recent Threat Events
        </h3>
        <span className="text-xs text-white/50">Live</span>
      </div>

      <div className="space-y-2 overflow-y-auto flex-1 pr-1">
        {threats.slice(0, limit).map((t) => (
          <div
            key={t.id}
            className="threat-row flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition border border-transparent hover:border-white/10"
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${severityColor[t.severity]}`}
            >
              {t.severity}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-white">{t.sourceIP}</span>
                <span className="text-white/40">→</span>
                <span className="font-mono text-accent-cyan">
                  :{t.targetPort}
                </span>
                {t.attackType && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30">
                    {t.attackType}
                  </span>
                )}
                {t.isZeroDay && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-purple/20 text-accent-purple border border-accent-purple/30">
                    0-DAY
                  </span>
                )}
              </div>
              <div className="text-xs text-white/50 mt-1 truncate">
                {t.organizationName} · {t.scanType.toUpperCase()} scan ·{' '}
                {t.targetService}
              </div>
            </div>
            <span className="text-xs text-white/40 whitespace-nowrap">
              {timeAgo(t.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
