'use client';

import { useState } from 'react';
import LogsPanel from '@/components/LogsPanel';
import ThreatReviewPanel from '@/components/ThreatReviewPanel';
import AlertsPanel from '@/components/AlertsPanel';
import RulesPanel from '@/components/RulesPanel';
import TargetsPanel from '@/components/TargetsPanel';

// Premium "Security Operations" view. Analysts can triage, confirm/flag
// threats and acknowledge/resolve alerts, but deleting records and toggling
// correlation rules stays admin-only (in /admin).
const TABS = [
  { id: 'assets', label: 'Assets', icon: '🌐', hint: 'Live website + host checks' },
  { id: 'logs', label: 'Logs', icon: '📜', hint: 'Collected security events' },
  { id: 'threats', label: 'Threats', icon: '🎯', hint: 'AI-detected threats' },
  { id: 'alerts', label: 'Alerts', icon: '🔔', hint: 'Raised incidents' },
  { id: 'rules', label: 'Rules', icon: '⚙️', hint: 'Correlation detection' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function MonitorPage() {
  const [tab, setTab] = useState<TabId>('assets');

  return (
    <div className="container mx-auto px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-accent-cyan/80 font-medium">
          Premium · Security Operations
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Threat <span className="text-gradient-animated">Monitor</span>
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Your live SIEM view: the real websites and computers you have
          registered (checked continuously), collected logs, AI-detected
          threats, raised alerts, and the correlation rules that power them.
          Triage threats and alerts here; deletion and rule changes stay with
          admins.
        </p>
      </header>

      <nav
        role="tablist"
        aria-label="Monitor sections"
        className="glass rounded-xl p-1.5 mb-6 flex flex-wrap gap-1"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[130px] px-4 py-2.5 rounded-lg text-sm font-medium text-left transition ${
                active
                  ? 'bg-gradient-to-r from-accent-cyan/20 to-accent-blue/10 text-white ring-1 ring-accent-cyan/40'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{t.icon}</span>
                <span className="font-semibold">{t.label}</span>
              </span>
              <span className="block text-[11px] text-white/40 mt-0.5">{t.hint}</span>
            </button>
          );
        })}
      </nav>

      {tab === 'assets' && <TargetsPanel scope="mine" />}
      {tab === 'logs' && <LogsPanel />}
      {tab === 'threats' && <ThreatReviewPanel canDelete={false} />}
      {tab === 'alerts' && <AlertsPanel canDelete={false} />}
      {tab === 'rules' && <RulesPanel readOnly />}
    </div>
  );
}
