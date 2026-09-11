'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logAPI } from '@/lib/api';
import type { LogEvent } from '@/types';

const SOURCES = ['', 'ssh', 'web', 'firewall', 'system', 'monitor'];

// eventType → badge colour.
const TYPE_STYLE: Record<string, string> = {
  auth_failure: 'bg-red-500/20 text-red-300 border-red-500/40',
  auth_success: 'bg-accent-green/20 text-accent-green border-accent-green/40',
  http_attack: 'bg-accent-purple/20 text-accent-purple border-accent-purple/40',
  http_request: 'bg-white/10 text-white/60 border-white/20',
  connection_denied: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40',
  port_connect: 'bg-white/10 text-white/60 border-white/20',
};

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LogsPanel() {
  const [logs, setLogs] = useState<LogEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  // The query the results on screen belong to; typing updates `q` immediately
  // but only this debounced copy triggers a request.
  const [activeQuery, setActiveQuery] = useState('');
  const [auto, setAuto] = useState(true);
  const [searching, setSearching] = useState(false);

  // Requests can finish out of order — a slow "10." landing after a fast
  // "10.20" would show the wrong results. Only the newest one may write.
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setSearching(true);
    try {
      const rows = await logAPI.search({
        source: source || undefined,
        q: activeQuery || undefined,
        limit: 300,
      });
      if (id !== requestId.current) return;
      setLogs(rows);
      setError(null);
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e.message : 'failed to load logs');
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  }, [source, activeQuery]);

  // Debounce typing so each keystroke doesn't fire its own request.
  useEffect(() => {
    const id = setTimeout(() => setActiveQuery(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, [auto, refresh]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveQuery(q.trim());
    refresh();
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold">Log Events</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Normalized events collected from SSH, web and firewall logs. The
            correlation engine runs rules over these.
          </p>
        </div>
        <label className="text-[11px] text-white/50 flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
          />
          auto-refresh
        </label>
      </div>

      <form
        onSubmit={submitSearch}
        className="flex flex-wrap gap-2 px-6 py-3 border-b border-white/10 bg-white/[0.02]"
      >
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-sm outline-none focus:border-accent-cyan/50"
        >
          {SOURCES.map((s) => (
            <option key={s || 'all'} value={s} className="bg-primary-dark">
              {s === '' ? 'all sources' : s}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search IP, port, user, message or raw line…"
          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-sm outline-none focus:border-accent-cyan/50 font-mono"
        />
        <button
          type="submit"
          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold text-sm"
        >
          Search
        </button>
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white text-sm"
          >
            Clear
          </button>
        )}
      </form>

      <div className="px-6 py-2 text-[11px] text-white/40 border-b border-white/5">
        {searching
          ? 'Searching…'
          : logs
            ? `${logs.length} event${logs.length === 1 ? '' : 's'}` +
              (activeQuery ? ` matching “${activeQuery}”` : '') +
              (source ? ` from ${source}` : '') +
              (logs.length === 300 ? ' (newest 300 shown)' : '')
            : ''}
      </div>

      {error && (
        <div className="px-6 py-3 text-sm text-red-300">
          Backend unreachable: <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 border-b border-white/10">
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">From IP</th>
              <th className="px-4 py-2 font-medium">Port</th>
              <th className="px-4 py-2 font-medium">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {logs?.map((l) => (
              <tr key={l.id} className="hover:bg-white/5">
                <td className="px-4 py-2 whitespace-nowrap text-white/60 font-mono text-xs">
                  {fmtTime(l.timestamp)}
                </td>
                <td className="px-4 py-2 text-white/70">{l.source}</td>
                <td className="px-4 py-2">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      TYPE_STYLE[l.eventType] ?? 'bg-white/10 text-white/60 border-white/20'
                    }`}
                  >
                    {l.eventType}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-white/80">{l.sourceIP ?? '-'}</td>
                <td className="px-4 py-2 font-mono text-white/50">{l.targetPort ?? '-'}</td>
                <td className="px-4 py-2 text-white/60 max-w-[340px] truncate">
                  {l.message ?? l.rawLine ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs && logs.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            {activeQuery || source ? (
              <>
                Nothing matched{' '}
                {activeQuery && <span className="font-mono">“{activeQuery}”</span>}
                {activeQuery && source && ' in '}
                {source && <span className="font-mono">{source}</span>}. Try a
                shorter term, or clear the filters.
              </>
            ) : (
              <>
                No log events yet. Ship some with{' '}
                <span className="font-mono">python log_shipper.py --all</span>.
              </>
            )}
          </div>
        )}
        {!logs && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">Loading logs…</div>
        )}
      </div>
    </div>
  );
}
