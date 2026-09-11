'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { dashboardAPI, orgAPI } from '@/lib/api';
import CustomersPanel from '@/components/CustomersPanel';
import NewOrgModal from '@/components/NewOrgModal';
import OrgRow from '@/components/OrgRow';
import ReportsPanel from '@/components/ReportsPanel';
import SeverityByOrg from '@/components/SeverityByOrg';
import TargetsPanel from '@/components/TargetsPanel';
import AlertsPanel from '@/components/AlertsPanel';
import ThreatReviewPanel from '@/components/ThreatReviewPanel';
import LogsPanel from '@/components/LogsPanel';
import RulesPanel from '@/components/RulesPanel';
import BlockedIpsPanel from '@/components/BlockedIpsPanel';
import type { DashboardStats, Organization } from '@/types';

type TabDef = {
  id: string;
  label: string;
  hint: string;
  icon: string;
  group: string;
};

// Tabs grouped into sections for a cleaner console-style sidebar.
const TABS: readonly TabDef[] = [
  { id: 'orgs', label: 'Organizations', hint: 'Severity + members', icon: '🏢', group: 'Federation' },
  { id: 'customers', label: 'Customers', hint: 'Plans + owners', icon: '👤', group: 'Federation' },
  { id: 'threats', label: 'Threats', hint: 'Confirm / flag FP', icon: '🎯', group: 'Detection (SIEM)' },
  { id: 'alerts', label: 'Alerts', hint: 'Acknowledge + resolve', icon: '🔔', group: 'Detection (SIEM)' },
  { id: 'logs', label: 'Logs', hint: 'Event stream', icon: '📜', group: 'Detection (SIEM)' },
  { id: 'rules', label: 'Rules', hint: 'Correlation engine', icon: '⚙️', group: 'Detection (SIEM)' },
  { id: 'response', label: 'Response', hint: 'Block IPs (firewall)', icon: '🛡️', group: 'Detection (SIEM)' },
  { id: 'targets', label: 'Assets', hint: 'Live site + host checks', icon: '🌐', group: 'Infrastructure' },
  { id: 'reports', label: 'Reports', hint: 'Generate + export', icon: '📄', group: 'Infrastructure' },
] as const;

const GROUP_ORDER = ['Federation', 'Detection (SIEM)', 'Infrastructure'];

type TabId = (typeof TABS)[number]['id'];

function isTabId(s: string | null): s is TabId {
  return !!s && TABS.some((t) => t.id === s);
}

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: TabId = isTabId(rawTab) ? rawTab : 'orgs';
  const activeTab = TABS.find((t) => t.id === tab)!;

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

  useGSAP(
    () => {
      gsap.from('.admin-stat', {
        y: 14,
        opacity: 0,
        stagger: 0.06,
        duration: 0.45,
        ease: 'power3.out',
      });
      gsap.fromTo(
        '.tab-pane',
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out', clearProps: 'transform,opacity' },
      );
    },
    { scope: root, dependencies: [tab, orgs === null] },
  );

  function selectTab(id: TabId) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', id);
    router.replace(`/admin?${next.toString()}`, { scroll: false });
  }

  const statCards = [
    { l: 'Member Orgs', v: stats ? String(stats.totalOrganizations) : '-', accent: 'text-accent-cyan' },
    {
      l: 'Active Now',
      v: orgs ? String(orgs.filter((o) => o.status === 'active').length) : '-',
      accent: 'text-accent-green',
    },
    { l: 'FL Round', v: stats ? `#${stats.federatedLearningRound}` : '-', accent: 'text-accent-blue' },
    { l: 'Model Acc.', v: stats ? `${Math.round(stats.detectionRate)}%` : '-', accent: 'text-accent-yellow' },
  ];

  return (
    <div ref={root} className="container mx-auto px-6 py-10">
      <header className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent-cyan/80 font-medium">
            Administration Console
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">
            Federation <span className="text-gradient-animated">Control</span>
          </h1>
        </div>
        <button
          onClick={() => {
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

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {statCards.map((s) => (
          <div
            key={s.l}
            className="admin-stat glass rounded-xl p-4 border border-white/5 hover:border-white/10 transition"
          >
            <p className="text-[10px] uppercase tracking-widest text-white/50">{s.l}</p>
            <p className={`font-display text-2xl font-bold mt-1 ${s.accent}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Console layout: grouped sidebar + content */}
      <div className="lg:grid lg:grid-cols-[232px_1fr] lg:gap-6">
        <aside className="mb-6 lg:mb-0">
          <nav
            role="tablist"
            aria-label="Admin sections"
            className="glass rounded-2xl p-3 lg:sticky lg:top-24 space-y-4"
          >
            {GROUP_ORDER.map((group) => (
              <div key={group}>
                <p className="px-2 mb-1.5 text-[10px] uppercase tracking-widest text-white/35 font-semibold">
                  {group}
                </p>
                <div className="space-y-1">
                  {TABS.filter((t) => t.group === group).map((t) => {
                    const active = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        role="tab"
                        aria-selected={active}
                        onClick={() => selectTab(t.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition ${
                          active
                            ? 'bg-gradient-to-r from-accent-cyan/20 to-accent-blue/10 text-white ring-1 ring-accent-cyan/40'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="text-base leading-none">{t.icon}</span>
                        <span className="min-w-0">
                          <span className="block font-medium leading-tight">{t.label}</span>
                          <span className="block text-[11px] text-white/40 leading-tight">
                            {t.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          {/* Content header */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xl">{activeTab.icon}</span>
            <h2 className="font-display text-xl font-bold">{activeTab.label}</h2>
            <span className="text-xs text-white/40">· {activeTab.hint}</span>
          </div>

          {tab === 'orgs' && (
            <div className="tab-pane space-y-6">
              {orgs && <SeverityByOrg orgs={orgs} />}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-semibold">Member Organizations</h3>
                    <p className="text-xs text-white/50 mt-0.5">
                      Click any row to expand severity + alerts, or use Edit / Delete.
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
                      No organizations yet. Click &quot;+ Invite Organization&quot; to add one.
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

          {tab === 'threats' && (
            <div className="tab-pane">
              <ThreatReviewPanel />
            </div>
          )}

          {tab === 'alerts' && (
            <div className="tab-pane">
              <AlertsPanel />
            </div>
          )}

          {tab === 'logs' && (
            <div className="tab-pane">
              <LogsPanel />
            </div>
          )}

          {tab === 'rules' && (
            <div className="tab-pane">
              <RulesPanel />
            </div>
          )}

          {tab === 'response' && (
            <div className="tab-pane">
              <BlockedIpsPanel />
            </div>
          )}

          {tab === 'targets' && (
            <div className="tab-pane">
              <TargetsPanel scope="all" />
            </div>
          )}

          {tab === 'reports' && (
            <div className="tab-pane">
              <ReportsPanel />
            </div>
          )}
        </main>
      </div>

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
