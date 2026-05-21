'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { toast } from 'react-hot-toast';
import OrgRow from '@/components/OrgRow';
import { orgAPI, reportAPI } from '@/lib/api';
import type {
  Organization,
  Report,
  Severity,
  SeverityCounts,
} from '@/types';

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

function formatWhen(d: Date): string {
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function UserPage() {
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? null;
  const isAdmin = session?.user?.role === 'admin';
  const isPremium = isAdmin || session?.user?.plan === 'premium';

  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [aggSeverity, setAggSeverity] = useState<SeverityCounts | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const root = useRef<HTMLDivElement>(null);

  // Pull the user's orgs, then aggregate severity across them.
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    orgAPI
      .byOwner(email)
      .then(async (xs) => {
        if (cancelled) return;
        setOrgs(xs);
        if (xs.length === 0) {
          setAggSeverity({ low: 0, medium: 0, high: 0, critical: 0 });
          return;
        }
        const stats = await Promise.all(xs.map((o) => orgAPI.severityStats(o.id)));
        if (cancelled) return;
        const agg: SeverityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
        for (const s of stats) {
          agg.low += s.low;
          agg.medium += s.medium;
          agg.high += s.high;
          agg.critical += s.critical;
        }
        setAggSeverity(agg);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  // Pull only the reports this user generated.
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    reportAPI
      .list({ generatedBy: email })
      .then((xs) => {
        if (!cancelled) setReports(xs);
      })
      .catch(() => {
        if (!cancelled) setReports([]);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  // Animate cards in ONCE on mount. Previously this re-ran when orgs went
  // from null → loaded (deps was [orgs === null]), which reset every card
  // back to opacity:0 and re-staggered — making the page look stuck loading
  // for ~1.7s after content was already available. fromTo + clearProps is
  // the same fix we used on /admin, /, and /attacks.
  useGSAP(
    () => {
      gsap.fromTo(
        '.user-card',
        { y: 16, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.06,
          duration: 0.45,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        },
      );
    },
    { scope: root },
  );

  async function generateMyReport() {
    if (!email) return;
    setGenerating(true);
    try {
      const r = await reportAPI.generate({
        title: reportTitle.trim() || undefined,
        type: 'USER_PORTFOLIO',
        ownerEmail: email,
        generatedBy: email,
      });
      toast.success(`Report ${r.id} saved`);
      setReports((prev) => (prev ? [r, ...prev] : [r]));
      setReportTitle('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  async function deleteReport(id: string) {
    const prev = reports;
    setReports((p) => p?.filter((r) => r.id !== id) ?? null);
    try {
      await reportAPI.remove(id);
      toast.success('Report deleted');
    } catch {
      toast.error('Failed to delete report');
      setReports(prev);
    }
  }

  function viewHtml(id: string) {
    window.open(reportAPI.downloadUrl(id, 'html'), '_blank', 'noopener');
  }

  function downloadJson(id: string) {
    const a = document.createElement('a');
    a.href = reportAPI.downloadUrl(id, 'json');
    a.download = `${id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-6 py-10 text-white/50">
        Loading your dashboard…
      </div>
    );
  }

  const sevMax = aggSeverity
    ? Math.max(
        aggSeverity.low,
        aggSeverity.medium,
        aggSeverity.high,
        aggSeverity.critical,
        1,
      )
    : 1;

  const totalThreats = aggSeverity
    ? aggSeverity.low + aggSeverity.medium + aggSeverity.high + aggSeverity.critical
    : 0;

  return (
    <div ref={root} className="container mx-auto px-6 py-10 space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-accent-green font-medium">
          Your account
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          My <span className="text-gradient">Operations</span>
        </h1>
        <p className="mt-3 text-white/60 max-w-2xl">
          Severity, alerts and reports for the organizations you own. Federation
          totals are not shown here — only your assets.
        </p>
      </header>

      {error && (
        <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
          Backend unreachable: <span className="font-mono">{error}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="user-card lg:col-span-1 glass rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-cyan to-accent-purple grid place-items-center font-display text-2xl font-bold">
              {(session?.user?.name || email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="font-display font-semibold text-lg">
                {session?.user?.name || 'Operator'}
              </p>
              <p className="text-sm text-white/60 break-all">{email}</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm">
            <Row k="Role" v={session?.user?.role ?? 'guest'} />
            <Row k="Plan" v={session?.user?.plan ?? 'free'} />
            <Row
              k="Organizations"
              v={orgs ? String(orgs.length) : '…'}
            />
            <Row k="Threats observed" v={String(totalThreats)} />
          </div>
        </div>

        <div className="user-card lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg">
              Severity across your organizations
            </h3>
            {!aggSeverity && <span className="text-xs text-white/40">loading…</span>}
          </div>
          <div className="space-y-3">
            {sevOrder.map((s) => {
              const v = aggSeverity?.[s] ?? 0;
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="uppercase text-white/50 tracking-wider">
                      {s}
                    </span>
                    <span className={`font-mono ${sevText[s]}`}>{v}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${sevBar[s]} transition-all duration-700`}
                      style={{ width: `${(v / sevMax) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {aggSeverity && totalThreats === 0 && (
            <p className="mt-4 text-xs text-white/40">
              No threats observed on your organizations yet.
            </p>
          )}
        </div>
      </div>

      {/* Your organizations */}
      <div className="user-card glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="font-display font-semibold">Your organizations</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Click an org to expand its severity breakdown and alerts.
          </p>
        </div>
        <div className="divide-y divide-white/5">
          {!isPremium && (
            <div className="px-6 py-8 text-center text-sm text-white/60">
              <p>Owning organizations requires a Premium plan.</p>
              <Link
                href="/pricing"
                className="inline-block mt-3 px-4 py-2 rounded-lg bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 text-xs"
              >
                Upgrade to Premium →
              </Link>
            </div>
          )}
          {isPremium && orgs?.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-white/60">
              No organizations assigned to you yet. Ask your admin to assign
              one from the Customers panel on <code className="text-accent-cyan">/admin</code>.
            </div>
          )}
          {orgs?.map((o) => (
            <OrgRow key={o.id} org={o} isNew={false} />
          ))}
          {orgs === null && !error && (
            <div className="px-6 py-8 text-center text-sm text-white/40">
              Loading your organizations…
            </div>
          )}
        </div>
      </div>

      {/* Reports — only the ones this user generated */}
      <div className="user-card glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-display font-semibold">Your reports</h3>
            <p className="text-xs text-white/50 mt-0.5">
              Generate a snapshot of your organizations only. Saved to the
              database, download as HTML (printable) or JSON.
            </p>
          </div>
          {reports && (
            <span className="text-xs text-white/50">{reports.length} saved</span>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            generateMyReport();
          }}
          className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-white/10 bg-white/[0.02]"
        >
          <input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Optional title (e.g. 'My weekly portfolio review')"
            className="col-span-12 sm:col-span-9 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
          />
          <button
            type="submit"
            disabled={generating || !isPremium || orgs?.length === 0}
            className="col-span-12 sm:col-span-3 px-4 py-2 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold text-sm hover:opacity-90 disabled:opacity-60"
            title={
              !isPremium
                ? 'Premium required'
                : orgs?.length === 0
                  ? 'No organizations assigned'
                  : ''
            }
          >
            {generating ? 'Generating…' : '+ Generate my report'}
          </button>
        </form>

        <div className="divide-y divide-white/5">
          {reports?.map((r) => (
            <div
              key={r.id}
              className="px-6 py-4 grid grid-cols-12 gap-3 items-center hover:bg-white/5"
            >
              <div className="col-span-12 sm:col-span-5">
                <p className="font-medium truncate">{r.title}</p>
                <p className="text-[11px] text-white/40 font-mono">{r.id}</p>
              </div>
              <div className="col-span-6 sm:col-span-3 text-xs text-white/60">
                {formatWhen(r.generatedAt)}
              </div>
              <div className="col-span-6 sm:col-span-2 text-xs text-white/60">
                <div>{r.totalOrgs} orgs</div>
                <div>{r.totalThreats} threats</div>
                <div>{r.totalAlerts} alerts</div>
              </div>
              <div className="col-span-12 sm:col-span-2 flex items-center justify-end gap-2 text-xs">
                <button
                  onClick={() => viewHtml(r.id)}
                  className="px-2 py-1 rounded-md bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30"
                >
                  View
                </button>
                <button
                  onClick={() => downloadJson(r.id)}
                  className="px-2 py-1 rounded-md border border-white/10 text-white/70 hover:bg-white/5"
                >
                  JSON
                </button>
                <button
                  onClick={() => deleteReport(r.id)}
                  className="text-red-300/70 hover:text-red-300"
                  aria-label="Delete report"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          {reports?.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-white/40">
              No reports yet. Generate your first one above.
            </div>
          )}
          {reports === null && (
            <div className="px-6 py-8 text-center text-sm text-white/40">
              Loading your reports…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-white/60 capitalize">{k}</span>
      <span className="font-medium capitalize">{v}</span>
    </div>
  );
}
