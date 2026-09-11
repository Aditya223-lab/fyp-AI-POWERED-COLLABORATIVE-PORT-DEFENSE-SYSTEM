'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { threatAPI } from '@/lib/api';
import type { ThreatEvent } from '@/types';
import { severityColor } from '@/lib/mock';

type ReviewFilter = 'all' | 'UNREVIEWED' | 'CONFIRMED' | 'FALSE_POSITIVE';

function timeAgo(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ThreatReviewPanel({
  readOnly = false,
  canDelete = true,
}: {
  readOnly?: boolean;
  canDelete?: boolean;
}) {
  const [threats, setThreats] = useState<ThreatEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function refresh() {
    try {
      setThreats(await threatAPI.all());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load threats');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function withBusy(id: string, on: boolean) {
    setBusy((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  async function review(
    t: ThreatEvent,
    status: 'CONFIRMED' | 'FALSE_POSITIVE' | 'UNREVIEWED',
  ) {
    withBusy(t.id, true);
    const next = status === 'UNREVIEWED' ? null : status;
    setThreats((p) =>
      p?.map((x) => (x.id === t.id ? { ...x, reviewStatus: next } : x)) ?? null,
    );
    try {
      await threatAPI.review(t.id, status);
      toast.success(
        status === 'UNREVIEWED'
          ? 'Review cleared'
          : `Marked ${status === 'CONFIRMED' ? 'confirmed' : 'false positive'}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'review failed');
      refresh();
    } finally {
      withBusy(t.id, false);
    }
  }

  async function remove(t: ThreatEvent) {
    const prev = threats;
    setThreats((p) => p?.filter((x) => x.id !== t.id) ?? null);
    try {
      await threatAPI.remove(t.id);
      toast.success('Threat deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'delete failed');
      setThreats(prev);
    }
  }

  const counts = useMemo(() => {
    const c = { confirmed: 0, falsePositive: 0, reviewed: 0 };
    for (const t of threats ?? []) {
      if (t.reviewStatus === 'CONFIRMED') c.confirmed++;
      else if (t.reviewStatus === 'FALSE_POSITIVE') c.falsePositive++;
      if (t.reviewStatus) c.reviewed++;
    }
    return c;
  }, [threats]);

  const shown =
    threats?.filter((t) => {
      if (filter === 'all') return true;
      if (filter === 'UNREVIEWED') return !t.reviewStatus;
      return t.reviewStatus === filter;
    }) ?? null;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold">Threat Review</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Confirm the AI&apos;s calls or flag false positives.{' '}
            {counts.reviewed > 0 && (
              <span className="text-white/70">
                {counts.confirmed} confirmed · {counts.falsePositive} false positive
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          {(['all', 'UNREVIEWED', 'CONFIRMED', 'FALSE_POSITIVE'] as ReviewFilter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  filter === f
                    ? 'bg-accent-cyan/20 text-white ring-1 ring-accent-cyan/40'
                    : 'text-white/50 hover:bg-white/5'
                }`}
              >
                {f === 'all'
                  ? 'All'
                  : f === 'FALSE_POSITIVE'
                    ? 'False +'
                    : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ),
          )}
        </div>
      </div>

      {error && (
        <div className="px-6 py-3 text-sm text-red-300">
          Backend unreachable: <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="divide-y divide-white/5 max-h-[640px] overflow-y-auto">
        {shown?.slice(0, 200).map((t) => {
          const isBusy = busy.has(t.id);
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 px-6 py-3 hover:bg-white/5"
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${severityColor[t.severity]}`}
              >
                {t.severity}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="font-mono text-white">{t.sourceIP}</span>
                  <span className="text-white/40">→</span>
                  <span className="font-mono text-accent-cyan">:{t.targetPort}</span>
                  {t.attackType && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30">
                      {t.attackType}
                    </span>
                  )}
                  {t.reviewStatus === 'CONFIRMED' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green border border-accent-green/40">
                      CONFIRMED
                    </span>
                  )}
                  {t.reviewStatus === 'FALSE_POSITIVE' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/60 border border-white/20">
                      FALSE +
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/50 mt-0.5 truncate">
                  {t.organizationName} · conf {(t.confidence * 100).toFixed(0)}% ·{' '}
                  {timeAgo(t.timestamp)}
                </div>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-2 shrink-0">
                  {t.reviewStatus !== 'CONFIRMED' && (
                    <button
                      disabled={isBusy}
                      onClick={() => review(t, 'CONFIRMED')}
                      className="text-xs text-accent-green/90 hover:text-accent-green disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  )}
                  {t.reviewStatus !== 'FALSE_POSITIVE' && (
                    <button
                      disabled={isBusy}
                      onClick={() => review(t, 'FALSE_POSITIVE')}
                      className="text-xs text-accent-yellow/90 hover:text-accent-yellow disabled:opacity-50"
                    >
                      False +
                    </button>
                  )}
                  {t.reviewStatus && (
                    <button
                      disabled={isBusy}
                      onClick={() => review(t, 'UNREVIEWED')}
                      className="text-xs text-white/50 hover:text-white disabled:opacity-50"
                    >
                      Clear
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => remove(t)}
                      className="text-xs text-red-300/70 hover:text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {shown && shown.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            No {filter === 'all' ? '' : filter.toLowerCase().replace('_', ' ')} threats.
          </div>
        )}
        {!threats && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            Loading threats…
          </div>
        )}
      </div>
    </div>
  );
}
