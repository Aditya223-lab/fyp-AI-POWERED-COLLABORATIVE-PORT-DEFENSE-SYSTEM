'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { reportAPI } from '@/lib/api';
import type { Report } from '@/types';

function formatWhen(d: Date): string {
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function ReportsPanel() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState('');

  async function refresh() {
    try {
      setReports(await reportAPI.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load reports');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const r = await reportAPI.generate({
        title: title.trim() || undefined,
        type: 'FEDERATION_SNAPSHOT',
        generatedBy: session?.user?.email || undefined,
      });
      toast.success(`Report ${r.id} saved`);
      setTitle('');
      setReports((prev) => (prev ? [r, ...prev] : [r]));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    const prev = reports;
    setReports((p) => p?.filter((r) => r.id !== id) ?? null);
    try {
      await reportAPI.remove(id);
      toast.success('Report deleted');
    } catch {
      toast.error('Failed to delete');
      setReports(prev);
    }
  }

  function viewHtml(id: string) {
    window.open(reportAPI.downloadUrl(id, 'html'), '_blank', 'noopener');
  }

  function downloadJson(id: string) {
    // anchor with download attr forces save-as
    const a = document.createElement('a');
    a.href = reportAPI.downloadUrl(id, 'json');
    a.download = `${id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="glass rounded-2xl overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold">Reports</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Generate a snapshot of orgs, threats, severity and alerts. Saved
            permanently in the database; download as HTML (printable) or JSON.
          </p>
        </div>
        {reports && (
          <span className="text-xs text-white/50">
            {reports.length} saved
          </span>
        )}
      </div>

      <form
        onSubmit={handleGenerate}
        className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-white/10 bg-white/[0.02]"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional title (e.g. 'May 2026 Federation Snapshot')"
          className="col-span-12 sm:col-span-9 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm"
        />
        <button
          type="submit"
          disabled={generating}
          className="col-span-12 sm:col-span-3 px-4 py-2 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold text-sm hover:opacity-90 disabled:opacity-60"
        >
          {generating ? 'Generating…' : '+ Generate report'}
        </button>
      </form>

      {error && (
        <div className="px-6 py-3 text-sm text-red-300">
          Backend unreachable: <span className="font-mono">{error}</span>
        </div>
      )}

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
              {r.generatedBy && (
                <div className="text-white/40">by {r.generatedBy}</div>
              )}
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
                title="Open HTML report in new tab"
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
                onClick={() => handleDelete(r.id)}
                className="text-red-300/70 hover:text-red-300"
                aria-label="Delete report"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {reports && reports.length === 0 && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            No reports yet. Click &quot;Generate report&quot; to snapshot the
            current state.
          </div>
        )}
        {!reports && !error && (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            Loading reports…
          </div>
        )}
      </div>
    </div>
  );
}
