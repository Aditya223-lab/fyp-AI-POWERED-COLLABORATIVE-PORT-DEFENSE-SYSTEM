'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { responseAPI } from '@/lib/api';
import type { BlockedIp } from '@/types';

function relativeTime(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function BlockedIpsPanel() {
  const [blocks, setBlocks] = useState<BlockedIp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBlocks(await responseAPI.blocks());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load blocks');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!ip.trim()) return;
    setBusy('new');
    try {
      const b = await responseAPI.block({
        ip: ip.trim(),
        reason: reason.trim() || undefined,
        source: 'MANUAL',
      });
      toast[b.enforcement === 'ENFORCED' ? 'success' : 'error'](
        b.enforcement === 'ENFORCED'
          ? `Firewall now blocks ${b.ipAddress}`
          : `Recorded (not enforced): ${b.detail ?? 'see row'}`,
      );
      setIp('');
      setReason('');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'block failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleUnblock(b: BlockedIp) {
    setBusy(b.id);
    try {
      await responseAPI.unblock(b.id);
      toast.success(`Unblocked ${b.ipAddress}`);
      refresh();
    } catch {
      toast.error('Unblock failed');
    } finally {
      setBusy(null);
    }
  }

  const active = blocks?.filter((b) => b.status === 'ACTIVE') ?? [];

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10">
        <h3 className="font-display font-semibold">Active Response — Blocked IPs</h3>
        <p className="text-xs text-white/50 mt-0.5 max-w-2xl">
          Add a rule to <strong>this machine&apos;s</strong> firewall dropping traffic
          from an IP. It only affects the computer running the backend, and needs
          the backend to run as Administrator to actually enforce — otherwise the
          block is recorded as <span className="font-mono">SIMULATED</span>.
        </p>
      </div>

      <form
        onSubmit={handleBlock}
        className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-white/10 bg-white/[0.02]"
      >
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="IP to block (e.g. 203.0.113.42)"
          className="col-span-12 sm:col-span-4 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm font-mono"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="col-span-12 sm:col-span-6 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
        />
        <button
          type="submit"
          disabled={busy === 'new'}
          className="col-span-12 sm:col-span-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500/80 to-red-600/80 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
        >
          {busy === 'new' ? 'Blocking…' : 'Block IP'}
        </button>
      </form>

      {error && (
        <div className="px-6 py-3 text-sm text-red-300">
          Backend unreachable: <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="px-6 py-2 text-[11px] text-white/40 border-b border-white/5">
        {blocks ? `${active.length} active · ${blocks.length} total` : ''}
      </div>

      <div className="divide-y divide-white/5">
        {blocks?.map((b) => (
          <div key={b.id} className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-white/5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm">{b.ipAddress}</span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    b.status === 'ACTIVE'
                      ? 'bg-red-500/15 text-red-300 border-red-500/40'
                      : 'bg-white/10 text-white/50 border-white/20'
                  }`}
                >
                  {b.status}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    b.enforcement === 'ENFORCED'
                      ? 'bg-accent-green/15 text-accent-green border-accent-green/40'
                      : 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40'
                  }`}
                  title={
                    b.enforcement === 'ENFORCED'
                      ? 'A real firewall rule was added on this machine'
                      : 'Recorded only — backend not elevated, or enforcement disabled'
                  }
                >
                  {b.enforcement}
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-0.5 truncate">
                {b.reason} · {relativeTime(b.createdAt)}
                {b.createdBy ? ` · ${b.createdBy}` : ''}
                {b.detail ? ` · ${b.detail}` : ''}
              </p>
            </div>
            {b.status === 'ACTIVE' && (
              <button
                onClick={() => handleUnblock(b)}
                disabled={busy === b.id}
                className="text-xs text-accent-cyan/80 hover:text-accent-cyan disabled:opacity-50 shrink-0"
              >
                {busy === b.id ? '…' : 'Unblock'}
              </button>
            )}
          </div>
        ))}
        {blocks && blocks.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            No IPs blocked. Block one above, or use the Block button on an attack
            in the Attack Stream.
          </div>
        )}
        {!blocks && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">Loading…</div>
        )}
      </div>
    </div>
  );
}
