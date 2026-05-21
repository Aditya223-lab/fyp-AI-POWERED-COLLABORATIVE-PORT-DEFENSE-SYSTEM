'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { targetAPI } from '@/lib/api';
import type { MonitorTarget } from '@/types';

function relativeTime(d: Date | null | undefined): string {
  if (!d) return 'never';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TargetsPanel() {
  const [targets, setTargets] = useState<MonitorTarget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  // form state
  const [name, setName] = useState('');
  const [ipAddress, setIpAddress] = useState('127.0.0.1');
  const [ports, setPorts] = useState('22,80,443,3306,5432,6379,8080,8443,27017');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    try {
      setTargets(await targetAPI.all());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load targets');
    }
  }

  useEffect(() => {
    refresh();
    // Auto-refresh so lastScannedAt + findings count tick up as the Python
    // scanner runs.
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  // Clear "new" highlight after 4 seconds.
  useEffect(() => {
    if (newIds.size === 0) return;
    const id = setTimeout(() => setNewIds(new Set()), 4000);
    return () => clearTimeout(id);
  }, [newIds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !ipAddress.trim() || !ports.trim()) {
      toast.error('Name, IP and ports are required');
      return;
    }
    setSubmitting(true);
    try {
      const t = await targetAPI.create({
        name: name.trim(),
        ipAddress: ipAddress.trim(),
        ports: ports.trim(),
      });
      setTargets((prev) => (prev ? [t, ...prev] : [t]));
      setNewIds((s) => new Set([...s, t.id]));
      toast.success(`Now monitoring ${t.name}`);
      setName('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'failed to add target');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const prev = targets;
    setTargets((p) => p?.filter((t) => t.id !== id) ?? null);
    try {
      await targetAPI.remove(id);
      toast.success('Target removed');
    } catch {
      toast.error('Failed to delete target');
      setTargets(prev);
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold">My Monitored Targets</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Register your Docker containers or hosts — the Python AI scans
            them every 30 seconds and posts alerts for risky exposures.
          </p>
        </div>
        {targets && (
          <span className="text-xs text-white/50">
            {targets.length} target{targets.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-white/10 bg-white/[0.02]"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. my-api)"
          className="col-span-12 sm:col-span-3 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
        />
        <input
          value={ipAddress}
          onChange={(e) => setIpAddress(e.target.value)}
          placeholder="IP (e.g. 127.0.0.1)"
          className="col-span-6 sm:col-span-3 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm font-mono"
        />
        <input
          value={ports}
          onChange={(e) => setPorts(e.target.value)}
          placeholder="Ports (e.g. 22,80,443 or 1-1024)"
          className="col-span-6 sm:col-span-4 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm font-mono"
        />
        <button
          type="submit"
          disabled={submitting}
          className="col-span-12 sm:col-span-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold text-sm hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Adding…' : '+ Add target'}
        </button>
      </form>

      {error && (
        <div className="px-6 py-3 text-sm text-red-300">
          Backend unreachable: <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="divide-y divide-white/5">
        {targets?.map((t) => {
          const isNew = newIds.has(t.id);
          const recentlyScanned =
            t.lastScannedAt &&
            Date.now() - t.lastScannedAt.getTime() < 60_000;
          return (
            <div
              key={t.id}
              className={`grid grid-cols-12 gap-3 items-center px-6 py-4 transition-all ${
                isNew
                  ? 'bg-accent-green/10 ring-1 ring-accent-green/40'
                  : 'hover:bg-white/5'
              }`}
            >
              <div className="col-span-12 sm:col-span-3 font-medium flex items-center gap-2">
                {t.name}
                {isNew && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-green/30 text-accent-green border border-accent-green/40 font-bold">
                    New
                  </span>
                )}
              </div>
              <div className="col-span-6 sm:col-span-3 text-sm font-mono text-white/70 truncate">
                {t.ipAddress}
              </div>
              <div className="col-span-6 sm:col-span-3 text-xs font-mono text-white/50 truncate">
                {t.ports}
              </div>
              <div className="col-span-8 sm:col-span-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      recentlyScanned
                        ? 'bg-accent-green animate-pulse'
                        : t.lastScannedAt
                          ? 'bg-accent-yellow'
                          : 'bg-white/30'
                    }`}
                  />
                  <span className="text-white/70">
                    {relativeTime(t.lastScannedAt)}
                  </span>
                </div>
                <div className="text-white/40 mt-0.5">
                  {t.lastFindingsCount} finding
                  {t.lastFindingsCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="col-span-4 sm:col-span-1 text-right">
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-xs text-red-300/70 hover:text-red-300"
                  aria-label="Delete target"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        {targets && targets.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            No targets yet. Add your first container above — try{' '}
            <span className="font-mono">127.0.0.1</span> with ports{' '}
            <span className="font-mono">22,80,443,6379,3306</span> to see the
            AI in action.
          </div>
        )}
        {!targets && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            Loading targets…
          </div>
        )}
      </div>
    </div>
  );
}
