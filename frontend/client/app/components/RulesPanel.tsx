'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ruleAPI } from '@/lib/api';
import type { CorrelationRule } from '@/types';

const SEV_STYLE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  warning: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40',
  info: 'bg-accent-blue/20 text-accent-blue border-accent-blue/40',
};

function relativeTime(d: Date | null | undefined): string {
  if (!d) return 'never';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function RulesPanel({ readOnly = false }: { readOnly?: boolean }) {
  const [rules, setRules] = useState<CorrelationRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function refresh() {
    try {
      setRules(await ruleAPI.all());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load rules');
    }
  }

  useEffect(() => {
    refresh();
    // Refresh so lastTriggered / triggerCount tick up as the engine fires.
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, []);

  async function toggle(r: CorrelationRule) {
    const enabled = !r.enabled;
    setBusy((s) => new Set([...s, r.id]));
    setRules((p) => p?.map((x) => (x.id === r.id ? { ...x, enabled } : x)) ?? null);
    try {
      await ruleAPI.setEnabled(r.id, enabled);
      toast.success(`${r.name} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'toggle failed');
      refresh();
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(r.id);
        return n;
      });
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10">
        <h3 className="font-display font-semibold">Correlation Rules</h3>
        <p className="text-xs text-white/50 mt-0.5">
          Rule-based detection that runs over collected log events every 20
          seconds, the SIEM half of the hybrid engine, alongside the ML model.
        </p>
      </div>

      {error && (
        <div className="px-6 py-3 text-sm text-red-300">
          {error.includes('403') || error.includes('401')
            ? 'Admin session required, sign in as an admin to manage rules.'
            : `Backend unreachable: ${error}`}
        </div>
      )}

      <div className="divide-y divide-white/5">
        {rules?.map((r) => {
          const isBusy = busy.has(r.id);
          return (
            <div key={r.id} className="px-6 py-4 hover:bg-white/5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.name}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-bold ${
                        SEV_STYLE[r.severity] ?? SEV_STYLE.warning
                      }`}
                    >
                      {r.severity}
                    </span>
                    {r.triggerCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30">
                        fired {r.triggerCount}×
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/60 mt-1">{r.description}</p>
                  <p className="text-[11px] text-white/40 mt-1 font-mono">
                    {r.source ? `${r.source} · ` : ''}
                    {r.eventType}
                    {r.distinctField ? ` · distinct ${r.distinctField}` : ''} · ≥
                    {r.threshold} in {r.windowSeconds}s · last {relativeTime(r.lastTriggeredAt)}
                  </p>
                </div>
                {readOnly ? (
                  <span
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      r.enabled
                        ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                        : 'bg-white/10 text-white/50 border border-white/20'
                    }`}
                  >
                    {r.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                ) : (
                  <button
                    disabled={isBusy}
                    onClick={() => toggle(r)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                      r.enabled
                        ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                        : 'bg-white/10 text-white/50 border border-white/20'
                    }`}
                  >
                    {r.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {rules && rules.length === 0 && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            No rules yet, they seed automatically on backend startup.
          </div>
        )}
        {!rules && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">Loading rules…</div>
        )}
      </div>
    </div>
  );
}
