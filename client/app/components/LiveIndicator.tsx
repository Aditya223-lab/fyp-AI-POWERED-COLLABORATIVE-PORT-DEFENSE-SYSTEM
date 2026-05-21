'use client';

import { useThreatStream } from '@/hooks/useThreatStream';

export default function LiveIndicator() {
  const { status, eventCount } = useThreatStream(1);

  const color =
    status === 'open'
      ? 'bg-accent-green'
      : status === 'connecting'
        ? 'bg-accent-yellow'
        : 'bg-red-500';

  const label =
    status === 'open'
      ? `Live · ${eventCount} events`
      : status === 'connecting'
        ? 'Connecting…'
        : 'Disconnected';

  return (
    <div
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs"
      title={label}
    >
      <span className="relative inline-flex">
        {status === 'open' && (
          <span
            className={`absolute inline-flex h-2.5 w-2.5 rounded-full ${color} opacity-60 animate-ping`}
          />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
      </span>
      <span className="text-white/70 font-medium tabular-nums">{label}</span>
    </div>
  );
}
