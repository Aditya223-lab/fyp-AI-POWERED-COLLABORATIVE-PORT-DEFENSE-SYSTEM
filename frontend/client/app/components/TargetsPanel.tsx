'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { ASSET_SSE_URL, targetAPI } from '@/lib/api';
import type { MonitorTarget, TargetCheck, TargetStatus, TargetType } from '@/types';
import EditTargetModal from '@/components/EditTargetModal';

type Props = {
  /**
   * 'all'  — every registered asset (admin console).
   * 'mine' — the signed-in customer's assets plus the shared demo ones
   *          (premium Monitor page).
   */
  scope?: 'all' | 'mine';
};

function relativeTime(d: Date | null | undefined): string {
  if (!d) return 'never';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const STATUS_STYLE: Record<TargetStatus, { dot: string; text: string; label: string }> = {
  UP: { dot: 'bg-accent-green', text: 'text-accent-green', label: 'Up' },
  DEGRADED: { dot: 'bg-accent-yellow', text: 'text-accent-yellow', label: 'Degraded' },
  DOWN: { dot: 'bg-red-400', text: 'text-red-300', label: 'Down' },
  UNKNOWN: { dot: 'bg-white/30', text: 'text-white/50', label: 'Pending' },
};

function daysUntil(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}

/** What the asset actually is, in one line: the URL, or host + IP. */
function addressLine(t: MonitorTarget): string {
  if (t.type === 'WEBSITE') return t.url ?? t.hostname ?? t.ipAddress;
  if (t.hostname) return `${t.hostname} → ${t.ipAddress || 'resolving…'}`;
  return t.ipAddress;
}

export default function TargetsPanel({ scope = 'all' }: Props) {
  const { data: session } = useSession();
  const ownerEmail = scope === 'mine' ? (session?.user?.email ?? null) : null;

  const [targets, setTargets] = useState<MonitorTarget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MonitorTarget | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<TargetCheck[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  // form state
  const [type, setType] = useState<TargetType>('WEBSITE');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [ports, setPorts] = useState('');
  const [interval, setIntervalSeconds] = useState(30);
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // scope === 'mine' waits for the session before its first fetch, otherwise
  // the request would go out without the owner filter and show everything.
  const ready = scope === 'all' || session !== undefined;
  const ownerRef = useRef(ownerEmail);
  ownerRef.current = ownerEmail;

  const refresh = useCallback(async () => {
    try {
      setTargets(await targetAPI.all(ownerRef.current));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load assets');
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    refresh();
    // Backstop poll: the SSE stream below carries every check result, this
    // just heals the table if the stream drops.
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [ready, refresh]);

  // Live updates: the backend pushes an asset the moment its real check ends.
  useEffect(() => {
    if (!ready) return;
    const es = new EventSource(ASSET_SSE_URL);
    es.addEventListener('hello', () => setLive(true));
    es.addEventListener('asset', (ev) => {
      try {
        const raw = JSON.parse((ev as MessageEvent).data) as MonitorTarget;
        const updated: MonitorTarget = {
          ...raw,
          createdAt: new Date(raw.createdAt),
          lastCheckedAt: raw.lastCheckedAt ? new Date(raw.lastCheckedAt) : null,
          tlsExpiresAt: raw.tlsExpiresAt ? new Date(raw.tlsExpiresAt) : null,
          lastScannedAt: raw.lastScannedAt ? new Date(raw.lastScannedAt) : null,
        };
        setTargets((prev) => {
          if (!prev) return prev;
          // Only apply it if this view is already showing that asset — keeps
          // the customer view from picking up someone else's asset.
          if (!prev.some((t) => t.id === updated.id)) return prev;
          return prev.map((t) => (t.id === updated.id ? updated : t));
        });
      } catch {
        // Ignore malformed frames; the poll above will correct the table.
      }
    });
    es.onerror = () => setLive(false);
    return () => es.close();
  }, [ready]);

  // Clear "new" highlight after 4 seconds.
  useEffect(() => {
    if (newIds.size === 0) return;
    const id = setTimeout(() => setNewIds(new Set()), 4000);
    return () => clearTimeout(id);
  }, [newIds]);

  async function openHistory(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    setHistory(null);
    try {
      setHistory(await targetAPI.history(id, 40));
    } catch {
      setHistory([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      toast.error('Name and address are required');
      return;
    }
    if (!authorized) {
      toast.error('Confirm you own this asset (or may probe it) first');
      return;
    }
    setSubmitting(true);
    try {
      const t = await targetAPI.create({
        name: name.trim(),
        type,
        address: address.trim(),
        ports: ports.trim() || undefined,
        checkIntervalSeconds: interval,
        ownerEmail: scope === 'mine' ? ownerEmail : undefined,
        authorized: true,
      });
      setTargets((prev) => (prev ? [t, ...prev] : [t]));
      setNewIds((s) => new Set([...s, t.id]));
      toast.success(`Now monitoring ${t.name}`);
      setName('');
      setAddress('');
      setPorts('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'failed to add asset');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckNow(id: string) {
    setBusy(id);
    try {
      const fresh = await targetAPI.checkNow(id);
      setTargets((prev) => prev?.map((t) => (t.id === id ? fresh : t)) ?? null);
      toast.success(`${fresh.name}: ${STATUS_STYLE[fresh.status].label}`);
      if (expanded === id) setHistory(await targetAPI.history(id, 40));
    } catch {
      toast.error('Check failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleEnabled(t: MonitorTarget) {
    setBusy(t.id);
    try {
      const updated = await targetAPI.update(t.id, { enabled: !t.enabled });
      setTargets((prev) => prev?.map((x) => (x.id === t.id ? updated : x)) ?? null);
      toast.success(updated.enabled ? 'Monitoring resumed' : 'Monitoring paused');
    } catch {
      toast.error('Could not update the asset');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    const prev = targets;
    setTargets((p) => p?.filter((t) => t.id !== id) ?? null);
    try {
      await targetAPI.remove(id);
      toast.success('Asset removed');
    } catch {
      toast.error('Failed to delete asset');
      setTargets(prev);
    }
  }

  const upCount = targets?.filter((t) => t.status === 'UP').length ?? 0;
  const downCount = targets?.filter((t) => t.status === 'DOWN').length ?? 0;

  return (
    <div className="glass rounded-2xl overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold flex items-center gap-2">
            {scope === 'mine' ? 'My Monitored Assets' : 'Monitored Assets'}
            <span
              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                live
                  ? 'text-accent-green border-accent-green/40 bg-accent-green/10'
                  : 'text-white/40 border-white/20'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-accent-green animate-pulse' : 'bg-white/30'}`}
              />
              {live ? 'Live' : 'Offline'}
            </span>
          </h3>
          <p className="text-xs text-white/50 mt-0.5 max-w-2xl">
            Real websites and computers, checked continuously by the backend:
            DNS lookup, HTTP response, TLS expiry, and TCP reachability of the
            ports you list. Only add assets you own or are allowed to probe.
          </p>
        </div>
        {targets && (
          <div className="text-xs text-white/50 text-right">
            <div>
              {targets.length} asset{targets.length === 1 ? '' : 's'}
            </div>
            <div className="mt-0.5">
              <span className="text-accent-green">{upCount} up</span>
              {' · '}
              <span className={downCount > 0 ? 'text-red-300' : 'text-white/40'}>
                {downCount} down
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="px-6 py-4 border-b border-white/10 bg-white/[0.02] space-y-3"
      >
        <div className="flex gap-1.5">
          {(['WEBSITE', 'HOST'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                type === t
                  ? 'bg-accent-cyan/20 text-white ring-1 ring-accent-cyan/40'
                  : 'text-white/50 hover:bg-white/5'
              }`}
            >
              {t === 'WEBSITE' ? '🌐 Website' : '🖥️ Computer / server'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'WEBSITE' ? 'Name (e.g. Company site)' : 'Name (e.g. web-server-1)'}
            className="col-span-12 sm:col-span-3 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={
              type === 'WEBSITE'
                ? 'https://example.com'
                : 'Public IP or hostname (e.g. 203.0.113.7)'
            }
            className="col-span-12 sm:col-span-4 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm font-mono"
          />
          <input
            value={ports}
            onChange={(e) => setPorts(e.target.value)}
            placeholder={type === 'WEBSITE' ? 'Port (default 443)' : 'Ports (22,80,443 or 1-1024)'}
            className="col-span-7 sm:col-span-3 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm font-mono"
          />
          <select
            value={interval}
            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
            className="col-span-5 sm:col-span-2 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
            aria-label="Check interval"
          >
            <option value={15}>every 15s</option>
            <option value={30}>every 30s</option>
            <option value={60}>every 1m</option>
            <option value={300}>every 5m</option>
          </select>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
              className="accent-accent-cyan"
            />
            I own this asset, or I have permission to monitor it.
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold text-sm hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Adding…' : '+ Monitor this asset'}
          </button>
        </div>
      </form>

      {error && (
        <div className="px-6 py-3 text-sm text-red-300">
          Backend unreachable: <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="divide-y divide-white/5">
        {targets?.map((t) => {
          const isNew = newIds.has(t.id);
          const style = STATUS_STYLE[t.status];
          const tlsDays = daysUntil(t.tlsExpiresAt);
          const open = expanded === t.id;
          return (
            <div
              key={t.id}
              className={`px-6 py-4 transition-all ${
                isNew ? 'bg-accent-green/10 ring-1 ring-accent-green/40' : 'hover:bg-white/5'
              }`}
            >
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 sm:col-span-3">
                  <div className="font-medium flex items-center gap-2">
                    <span title={t.type === 'WEBSITE' ? 'Website' : 'Computer / server'}>
                      {t.type === 'WEBSITE' ? '🌐' : '🖥️'}
                    </span>
                    {t.name}
                    {!t.enabled && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                        Paused
                      </span>
                    )}
                    {isNew && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-green/30 text-accent-green border border-accent-green/40 font-bold">
                        New
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => openHistory(t.id)}
                    className="text-xs font-mono text-white/50 hover:text-accent-cyan truncate max-w-full text-left"
                    title="Show recent checks"
                  >
                    {addressLine(t)}
                  </button>
                </div>

                <div className="col-span-6 sm:col-span-2">
                  <div className={`flex items-center gap-1.5 text-sm ${style.text}`}>
                    <span
                      className={`w-2 h-2 rounded-full ${style.dot} ${
                        t.status === 'UP' && t.enabled ? 'animate-pulse' : ''
                      }`}
                    />
                    {style.label}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    checked {relativeTime(t.lastCheckedAt)}
                  </div>
                </div>

                <div className="col-span-6 sm:col-span-2 text-xs">
                  <div className="font-mono text-white/70 truncate" title={t.resolvedIps ?? ''}>
                    {t.ipAddress || '—'}
                  </div>
                  <div className="text-white/40 mt-0.5">
                    {t.latencyMs != null ? `${t.latencyMs} ms` : 'no response'}
                  </div>
                </div>

                <div className="col-span-6 sm:col-span-2 text-xs">
                  {t.type === 'WEBSITE' ? (
                    <>
                      <div className="text-white/70">
                        {t.httpStatus != null ? `HTTP ${t.httpStatus}` : '—'}
                      </div>
                      <div
                        className={`mt-0.5 ${
                          tlsDays != null && tlsDays <= 14 ? 'text-accent-yellow' : 'text-white/40'
                        }`}
                      >
                        {tlsDays != null ? `TLS ${tlsDays}d left` : 'no TLS data'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-white/70 font-mono truncate" title={t.openPorts ?? ''}>
                        {t.openPorts ? `open: ${t.openPorts}` : 'no open ports'}
                      </div>
                      <div className="text-white/40 mt-0.5">
                        {t.lastFindingsCount} AI finding{t.lastFindingsCount === 1 ? '' : 's'}
                      </div>
                    </>
                  )}
                </div>

                <div className="col-span-6 sm:col-span-1 text-xs">
                  <div className="text-white/70">{t.uptimePercent.toFixed(1)}%</div>
                  <div className="text-white/40 mt-0.5">{t.checksTotal} checks</div>
                </div>

                <div className="col-span-12 sm:col-span-2 flex sm:justify-end gap-3 text-xs">
                  <button
                    onClick={() => handleCheckNow(t.id)}
                    disabled={busy === t.id}
                    className="text-accent-cyan/80 hover:text-accent-cyan disabled:opacity-50"
                  >
                    {busy === t.id ? '…' : 'Check'}
                  </button>
                  <button
                    onClick={() => handleToggleEnabled(t)}
                    disabled={busy === t.id}
                    className="text-white/50 hover:text-white disabled:opacity-50"
                  >
                    {t.enabled ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => setEditing(t)}
                    className="text-white/50 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-red-300/70 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {t.lastError && t.status !== 'UP' && (
                <p className="mt-2 text-[11px] text-red-300/80 font-mono truncate">
                  {t.lastError}
                </p>
              )}

              {open && (
                <div className="mt-3 rounded-lg bg-black/20 border border-white/10 p-3">
                  <div className="flex items-center justify-between text-[11px] text-white/50 mb-2">
                    <span>Recent checks (newest on the right)</span>
                    <span className="font-mono">
                      {t.resolvedIps ? `DNS: ${t.resolvedIps}` : 'no DNS records'}
                    </span>
                  </div>
                  {history === null ? (
                    <p className="text-xs text-white/40">Loading history…</p>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-white/40">
                      No checks recorded yet — the first one runs within a few seconds.
                    </p>
                  ) : (
                    <div className="flex items-end gap-[3px] h-12">
                      {[...history].reverse().map((c, i) => {
                        const s = STATUS_STYLE[c.status];
                        const height =
                          c.latencyMs < 0
                            ? 100
                            : Math.max(12, Math.min(100, (c.latencyMs / 1500) * 100));
                        return (
                          <div
                            key={`${c.checkedAt.getTime()}-${i}`}
                            className={`flex-1 rounded-sm ${s.dot} opacity-80`}
                            style={{ height: `${height}%` }}
                            title={`${c.checkedAt.toLocaleTimeString()} — ${s.label}${
                              c.latencyMs >= 0 ? `, ${c.latencyMs} ms` : ''
                            }${c.detail ? ` (${c.detail})` : ''}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {targets && targets.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            No assets yet. Add your website (<span className="font-mono">https://example.com</span>)
            or a computer you run — <span className="font-mono">127.0.0.1</span> with ports{' '}
            <span className="font-mono">22,80,443,3306</span> works for a local demo.
          </div>
        )}
        {!targets && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">Loading assets…</div>
        )}
      </div>

      <EditTargetModal
        open={editing !== null}
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}
