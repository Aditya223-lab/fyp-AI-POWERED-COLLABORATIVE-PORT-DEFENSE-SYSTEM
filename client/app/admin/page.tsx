'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { dashboardAPI, orgAPI } from '@/lib/api'; //components are pullled from here
import CustomersPanel from '@/components/CustomersPanel';
import NewOrgModal from '@/components/NewOrgModal';
import OrgRow from '@/components/OrgRow';
import ReportsPanel from '@/components/ReportsPanel';
import SeverityByOrg from '@/components/SeverityByOrg';
import TargetsPanel from '@/components/TargetsPanel';
import type { DashboardStats, Organization } from '@/types';

const TABS = [
  {
    id: 'orgs',
    label: 'Organizations',
    hint: 'Severity + member list',
  },
  {
    id: 'customers',
    label: 'Customers',
    hint: 'Users, plans, org owners',
  },
  {
    id: 'targets',
    label: 'Targets',
    hint: 'Monitored hosts',
  },
  {
    id: 'reports' ,
    label: 'Reports',
    hint: 'Generate + download',
  },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTabId(s: string | null): s is TabId {
  return !!s && TABS.some((t) => t.id === s);
}

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: TabId = isTabId(rawTab) ? rawTab : 'orgs';

  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [newOrgIds, setNewOrgIds] = useState<Set<string>>(new Set());
  const root = useRef<HTMLDivElement>(null);

  const refreshAll = useCallback(async () => {
    try {
      const [o, s] = await Promise.all([orgAPI.all(), dashboardAPI.stats()]);
      setOrgs(o);
      setStats(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (newOrgIds.size === 0) return;
    const id = setTimeout(() => setNewOrgIds(new Set()), 4000);
    return () => clearTimeout(id);
  }, [newOrgIds]);

  // Animate the active tab's content gently as it mounts. Use fromTo with
  // clearProps so an interrupted animation can't leave content invisible
  // — the previous bug we hit with .org-row.
  useGSAP(
    () => {
      gsap.from('.admin-stat', {
        y: 16,
        opacity: 0,
        stagger: 0.06,
        duration: 0.5,
        ease: 'power3.out',
      });
      gsap.fromTo(
        '.tab-pane',
        { y: 12, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.35,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        },
      );
    },
    { scope: root, dependencies: [tab, orgs === null] },
  );

  function selectTab(id: TabId) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', id);
    router.replace(`/admin?${next.toString()}`, { scroll: false });
  }

  return (
    <div ref={root} className="container mx-auto px-6 py-10">
      <header className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent-yellow font-medium">
            Administration
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">
            Federation <span className="text-gradient">Control</span>
          </h1>
        </div>
        <button
          onClick={() => {
            // Open the modal and jump to the orgs tab so the new row is model make it work now
            // visible as soon as it lands.
            setShowInvite(true);
            if (tab !== 'orgs') selectTab('orgs');
          }}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold hover:opacity-90 transition glow"
        >
          + Invite Organization
        </button>
      </header>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300">
          Backend unreachable: <span className="font-mono">{error}</span>
        </div>
      )}

      {/* Always-visible quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            l: 'Member Orgs',
            v: stats ? String(stats.totalOrganizations) : '—',
          },
          {
            l: 'Active Now',
            v: orgs
              ? String(orgs.filter((o) => o.status === 'active').length)
              : '—',
          },
          {
            l: 'FL Round',
            v: stats ? `#${stats.federatedLearningRound}` : '—',
          },
          {
            l: 'Model Acc.',
            v: stats ? `${Math.round(stats.detectionRate)}%` : '—',
          },
        ].map((s) => (
          <div key={s.l} className="admin-stat glass rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/50">
              {s.l}
            </p>
            <p className="font-display text-2xl font-bold mt-1 text-gradient">
              {s.v}
            </p>
          </div>
        ))}
      </div>

      
      <nav
        role="tablist"
        aria-label="Admin sections"
        className="glass rounded-xl p-1.5 mb-6 flex flex-wrap gap-1 sticky top-20 z-20"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.id)}
              className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg text-sm font-medium text-left transition ${
                active
                  ? 'bg-gradient-to-r from-accent-cyan/20 to-accent-blue/10 text-white ring-1 ring-accent-cyan/40'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="font-semibold">{t.label}</div>
              <div className="text-[11px] text-white/40 mt-0.5">{t.hint}</div>
            </button>
          );
        })}
      </nav>

      {/* Active tab */}
      {tab === 'orgs' && (
        <div className="tab-pane space-y-6">
          {orgs && <SeverityByOrg orgs={orgs} />}

          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold">
                  Member Organizations
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Click any row to expand severity + alerts, or use the
                  Edit/Delete buttons.
                </p>
              </div>
              <span className="text-xs text-white/50">
                {orgs
                  ? `${orgs.length} of ${stats?.totalOrganizations ?? orgs.length} shown`
                  : 'loading…'}
              </span>
            </div>
            <div className="divide-y divide-white/5">
              {orgs?.map((o) => (
                <OrgRow
                  key={o.id}
                  org={o}
                  isNew={newOrgIds.has(o.id)}
                  editable
                  onChanged={() => refreshAll()}
                />
              ))}
              {!orgs && !error && (
                <div className="px-6 py-8 text-center text-sm text-white/40">
                  Loading organizations…
                </div>
              )}
              {orgs && orgs.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-white/40">
                  No organizations yet. Click &quot;+ Invite Organization&quot; to
                  add one.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <div className="tab-pane">
          {orgs ? (
            <CustomersPanel orgs={orgs} onOrgsChanged={() => refreshAll()} />
          ) : (
            <div className="glass rounded-2xl px-6 py-8 text-center text-sm text-white/40">
              Loading customers…
            </div>
          )}
        </div>
      )}

      {tab === 'targets' && (
        <div className="tab-pane">
          <TargetsPanel />
        </div>
      )}

      {tab === 'reports' && (
        <div className="tab-pane">
          <ReportsPanel />
        </div>
      )}

      <NewOrgModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onCreated={(o) => {
          setNewOrgIds((s) => new Set([...s, o.id]));
          refreshAll();
        }}
      />
    </div>
  );
}
