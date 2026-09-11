'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { alertAPI } from '@/lib/api';
import type { Alert } from '@/types';

type StatusFilter = 'all' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
type SeverityFilter = 'all' | 'info' | 'warning' | 'critical';

function relativeTime(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-red-500/20 text-red-300 border-red-500/40',
  ACKNOWLEDGED: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40',
  RESOLVED: 'bg-accent-green/20 text-accent-green border-accent-green/40',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  warning: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30',
  info: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30',
};

export default function AlertsPanel({
  readOnly = false,
  canDelete = true,
}: {
  readOnly?: boolean;
  canDelete?: boolean;
}) {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function refresh() {
    try {
      setAlerts(await alertAPI.all());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load alerts');
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, []);

  async function setStatus(a: Alert, status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED') {
    setBusy((s) => new Set([...s, a.id]));
    // Optimistic update.
    setAlerts((prev) => prev?.map((x) => (x.id === a.id ? { ...x, status } : x)) ?? null);
    try {
      await alertAPI.setStatus(a.id, status);
      toast.success(`Alert ${status.toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'update failed');
      refresh();
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
    }
  }

  async function remove(a: Alert) {
    const prev = alerts;
    setAlerts((p) => p?.filter((x) => x.id !== a.id) ?? null);
    try {
      await alertAPI.remove(a.id);
      toast.success('Alert deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'delete failed');
      setAlerts(prev);
    }
  }

  // Which engines have actually raised alerts (AI-Classifier,
  // Correlation-Engine, Asset-Monitor, …) — built from the data so a new
  // detector shows up here on its own.
  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts ?? []) if (a.source) set.add(a.source);
    return ['all', ...Array.from(set).sort()];
  }, [alerts]);

  // Alerts arrive in full from the API, so filtering is instant and local.
  // The text term matches the title, description and source — which is where
  // IPs, ports, asset names and attack types all end up.
  const shown = useMemo(() => {
    if (!alerts) return null;
    const term = q.trim().toLowerCase();
    return alerts.filter((a) => {
      if (filter !== 'all' && (a.status ?? 'ACTIVE') !== filter) return false;
      if (severity !== 'all' && a.severity !== severity) return false;
      if (sourceFilter !== 'all' && a.source !== sourceFilter) return false;
      if (!term) return true;
      return (
        a.title.toLowerCase().includes(term) ||
        a.description.toLowerCase().includes(term) ||
        (a.source ?? '').toLowerCase().includes(term)
      );
    });
  }, [alerts, filter, severity, sourceFilter, q]);

  const hasFilters =
    filter !== 'all' || severity !== 'all' || sourceFilter !== 'all' || q.trim() !== '';

  function clearFilters() {
    setFilter('all');
    setSeverity('all');
    setSourceFilter('all');
    setQ('');
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold">Security Alerts</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Acknowledge or resolve alerts the AI raised for critical / zero-day
            threats.
          </p>
        </div>
        <div className="flex gap-1">
          {(['all', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                filter === f
                  ? 'bg-accent-cyan/20 text-white ring-1 ring-accent-cyan/40'
                  : 'text-white/50 hover:bg-white/5'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-3 border-b border-white/10 bg-white/[0.02] flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, description, IP, asset…"
            className="w-full px-3 py-1.5 pr-8 rounded-lg bg-black/30 border border-white/10 text-sm outline-none focus:border-accent-cyan/50 font-mono"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
          className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-sm outline-none focus:border-accent-cyan/50"
          aria-label="Filter by severity"
        >
          {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map((s) => (
            <option key={s} value={s} className="bg-primary-dark">
              {s === 'all' ? 'all severities' : s}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-sm outline-none focus:border-accent-cyan/50"
          aria-label="Filter by source"
        >
          {sources.map((s) => (
            <option key={s} value={s} className="bg-primary-dark">
              {s === 'all' ? 'all sources' : s}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white text-sm"
          >
            Clear
          </button>
        )}
      </div>

      {alerts && (
        <div className="px-6 py-2 text-[11px] text-white/40 border-b border-white/5">
          {shown?.length ?? 0} of {alerts.length} alert
          {alerts.length === 1 ? '' : 's'}
          {q.trim() && ` matching “${q.trim()}”`}
        </div>
      )}

      {error && (
        <div className="px-6 py-3 text-sm text-red-300">
          Backend unreachable: <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="divide-y divide-white/5">
        {shown?.map((a) => {
          const status = a.status ?? 'ACTIVE';
          const isBusy = busy.has(a.id);
          return (
            <div key={a.id} className="px-6 py-4 hover:bg-white/5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-bold ${
                        STATUS_STYLES[status] ?? STATUS_STYLES.ACTIVE
                      }`}
                    >
                      {status}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.info
                      }`}
                    >
                      {a.severity}
                    </span>
                    <span className="font-medium text-sm">{a.title}</span>
                  </div>
                  <p className="text-xs text-white/60 mt-1">{a.description}</p>
                  <p className="text-[11px] text-white/40 mt-1 font-mono">
                    {a.source} · {relativeTime(a.timestamp)}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {status !== 'ACKNOWLEDGED' && status !== 'RESOLVED' && (
                      <button
                        disabled={isBusy}
                        onClick={() => setStatus(a, 'ACKNOWLEDGED')}
                        className="text-xs text-accent-yellow/90 hover:text-accent-yellow disabled:opacity-50"
                      >
                        Acknowledge
                      </button>
                    )}
                    {status !== 'RESOLVED' && (
                      <button
                        disabled={isBusy}
                        onClick={() => setStatus(a, 'RESOLVED')}
                        className="text-xs text-accent-green/90 hover:text-accent-green disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    )}
                    {status !== 'ACTIVE' && (
                      <button
                        disabled={isBusy}
                        onClick={() => setStatus(a, 'ACTIVE')}
                        className="text-xs text-white/50 hover:text-white disabled:opacity-50"
                      >
                        Re-open
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => remove(a)}
                        className="text-xs text-red-300/70 hover:text-red-300"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {shown && shown.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            {hasFilters ? (
              <>
                No alerts match these filters.{' '}
                <button
                  onClick={clearFilters}
                  className="text-accent-cyan hover:underline"
                >
                  Clear them
                </button>
                .
              </>
            ) : (
              'No alerts yet.'
            )}
          </div>
        )}
        {!alerts && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            Loading alerts…
          </div>
        )}
      </div>
    </div>
  );
}
