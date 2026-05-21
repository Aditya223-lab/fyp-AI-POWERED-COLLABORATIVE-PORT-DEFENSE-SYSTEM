'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import EditOrgModal from '@/components/EditOrgModal';
import { orgAPI } from '@/lib/api';
import type { Alert, Organization, Severity, SeverityCounts } from '@/types';

const statusColor: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  warning: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  offline: 'bg-white/10 text-white/50 border-white/20',
};

const sevOrder: Severity[] = ['low', 'medium', 'high', 'critical'];

const sevBar: Record<Severity, string> = {
  low: 'from-emerald-500 to-emerald-400',
  medium: 'from-yellow-500 to-yellow-400',
  high: 'from-orange-500 to-orange-400',
  critical: 'from-red-500 to-red-400',
};

const sevText: Record<Severity, string> = {
  low: 'text-emerald-300',
  medium: 'text-yellow-300',
  high: 'text-orange-300',
  critical: 'text-red-300',
};

const alertSevBadge: Record<string, string> = {
  info: 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40',
  warning: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

interface Props {
  org: Organization;
  isNew: boolean;
  // Admin pages should pass this so the parent can refetch after edit/delete.
  // /user page can omit it (read-only view).
  onChanged?: () => void;
  editable?: boolean;
}

export default function OrgRow({ org, isNew, onChanged, editable = false }: Props) {
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState<SeverityCounts | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-fetch whenever the row is opened OR the underlying org changes (e.g.
  // after an edit the parent passes a fresh org).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([orgAPI.severityStats(org.id), orgAPI.alertsFor(org.id)])
      .then(([s, a]) => {
        if (cancelled) return;
        setSeverity(s);
        setAlerts(a);
      })
      .catch(() => {
        if (cancelled) return;
        setSeverity({ low: 0, medium: 0, high: 0, critical: 0 });
        setAlerts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, org.id, org.ipAddresses.length, org.ownerEmail]);

  const max = severity
    ? Math.max(severity.low, severity.medium, severity.high, severity.critical, 1)
    : 1;

  const totalThreats = severity
    ? severity.low + severity.medium + severity.high + severity.critical
    : 0;

  async function handleDelete() {
    const confirmed = window.confirm(
      `Permanently delete "${org.name}" (${org.id}) from the database?\n\n` +
        'This removes the organization itself; threats and alerts that ' +
        'reference it will remain but their org-id will point to nothing.',
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await orgAPI.remove(org.id);
      toast.success(`Deleted ${org.name}`);
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
    }
  }

  return (
    <div
      className={`org-row transition-all ${
        isNew
          ? 'bg-accent-green/10 ring-1 ring-accent-green/40'
          : 'hover:bg-white/[0.03]'
      }`}
    >
      {/* Whole top region is clickable to expand. Edit/Delete buttons live in
          their own column and stopPropagation so they don't toggle the row. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="px-6 py-4 cursor-pointer select-none"
      >
        <div className="grid grid-cols-12 gap-3 items-center">
          <div className="col-span-12 sm:col-span-4 font-medium flex items-center gap-2">
            <span
              className={`inline-block w-3 text-white/40 transition-transform ${
                open ? 'rotate-90' : ''
              }`}
              aria-hidden
            >
              ›
            </span>
            <span className="truncate">{org.name}</span>
            {isNew && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-green/30 text-accent-green border border-accent-green/40 font-bold">
                New
              </span>
            )}
          </div>
          <div className="col-span-4 sm:col-span-2 text-sm text-white/60 capitalize">
            {org.industry}
          </div>
          <div className="col-span-4 sm:col-span-2 text-sm">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusColor[org.status]}`}
            >
              {org.status}
            </span>
          </div>
          <div className="col-span-2 text-sm font-mono text-white/80">
            {org.detectedAttacks.toLocaleString()}
          </div>
          <div className="col-span-2 text-sm font-mono text-white/60 flex items-center justify-between gap-2">
            <span>{org.memberCount} users</span>
            {editable && (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEdit(true);
                  }}
                  className="text-[11px] px-2 py-0.5 rounded border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
                  aria-label={`Edit ${org.name}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  disabled={deleting}
                  className="text-[11px] px-2 py-0.5 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  aria-label={`Delete ${org.name}`}
                >
                  {deleting ? '…' : 'Delete'}
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-12 gap-3 items-start text-xs">
          <div className="col-span-12 sm:col-span-4 text-white/40">
            Owner:{' '}
            {org.ownerEmail ? (
              <span className="text-accent-cyan font-mono">{org.ownerEmail}</span>
            ) : (
              <span className="text-white/30 italic">unassigned</span>
            )}
          </div>
          <div className="col-span-12 sm:col-span-8 text-white/40">
            IPs:{' '}
            {org.ipAddresses.length > 0 ? (
              <span className="font-mono text-white/70">
                {org.ipAddresses.join(', ')}
              </span>
            ) : (
              <span className="text-white/30 italic">none</span>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="px-6 pb-4">
          <div className="grid lg:grid-cols-2 gap-4 pt-4 border-t border-white/5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs uppercase tracking-widest text-white/50">
                  Severity{' '}
                  <span className="ml-1 text-white/30 font-normal">
                    · {totalThreats} threats
                  </span>
                </h4>
                {loading && (
                  <span className="text-[11px] text-white/30">loading…</span>
                )}
              </div>
              {severity && totalThreats === 0 && !loading && (
                <p className="text-xs text-white/40 italic mb-2">
                  No threats observed on this organization yet.
                </p>
              )}
              <div className="space-y-2">
                {sevOrder.map((s) => {
                  const v = severity?.[s] ?? 0;
                  return (
                    <div key={s}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="uppercase text-white/50 tracking-wider">
                          {s}
                        </span>
                        <span className={`font-mono ${sevText[s]}`}>{v}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${sevBar[s]} transition-all duration-500`}
                          style={{ width: `${(v / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-widest text-white/50 mb-2">
                Alerts ({alerts?.length ?? 0})
              </h4>
              {alerts && alerts.length === 0 && !loading && (
                <p className="text-xs text-white/40 italic">
                  No alerts attributed to this organization.
                </p>
              )}
              <ul className="space-y-2">
                {alerts?.slice(0, 6).map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          alertSevBadge[a.severity] ?? alertSevBadge.info
                        }`}
                      >
                        {a.severity}
                      </span>
                      <span className="text-white/40 text-[11px]">
                        {a.source}
                      </span>
                      {a.actionRequired && (
                        <span className="text-[10px] uppercase tracking-wider text-accent-yellow ml-auto">
                          action needed
                        </span>
                      )}
                    </div>
                    <p className="text-white/80">{a.title}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {editable && (
        <EditOrgModal
          open={showEdit}
          org={org}
          onClose={() => setShowEdit(false)}
          onSaved={() => onChanged?.()}
        />
      )}
    </div>
  );
}
