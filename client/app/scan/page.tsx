'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { vtAPI } from '@/lib/api';
import type { FileScan, IndicatorReport, ScanVerdict } from '@/types';

const VERDICT_STYLE: Record<ScanVerdict, { chip: string; label: string; icon: string }> = {
  CLEAN: {
    chip: 'bg-accent-green/15 text-accent-green border-accent-green/40',
    label: 'Clean',
    icon: '✓',
  },
  SUSPICIOUS: {
    chip: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40',
    label: 'Suspicious',
    icon: '!',
  },
  MALICIOUS: {
    chip: 'bg-red-500/15 text-red-300 border-red-500/40',
    label: 'Malicious',
    icon: '⚠',
  },
  UNKNOWN: {
    chip: 'bg-white/10 text-white/60 border-white/20',
    label: 'Unknown',
    icon: '?',
  },
  ERROR: {
    chip: 'bg-red-500/10 text-red-300/80 border-red-500/30',
    label: 'Error',
    icon: '×',
  },
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(d: Date): string {
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Proportional bar of malicious / suspicious / clean engine opinions. */
function EngineBar({ scan }: { scan: FileScan | IndicatorReport }) {
  const total =
    scan.malicious + scan.suspicious + scan.harmless + scan.undetected || 1;
  const segments = [
    { n: scan.malicious, cls: 'bg-red-400' },
    { n: scan.suspicious, cls: 'bg-accent-yellow' },
    { n: scan.harmless, cls: 'bg-accent-green' },
    { n: scan.undetected, cls: 'bg-white/20' },
  ];
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
      {segments.map((s, i) =>
        s.n > 0 ? (
          <div key={i} className={s.cls} style={{ width: `${(s.n / total) * 100}%` }} />
        ) : null,
      )}
    </div>
  );
}

export default function ScanPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [maxBytes, setMaxBytes] = useState(32 * 1024 * 1024);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<FileScan | null>(null);
  const [history, setHistory] = useState<FileScan[]>([]);
  const [dragging, setDragging] = useState(false);
  const [indicator, setIndicator] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [report, setReport] = useState<IndicatorReport | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await vtAPI.history(25));
    } catch {
      /* history is a nicety; a failure here shouldn't block scanning */
    }
  }, []);

  useEffect(() => {
    vtAPI
      .status()
      .then((s) => {
        setConfigured(s.configured);
        setMaxBytes(s.maxFileBytes);
      })
      .catch(() => setConfigured(false));
    refreshHistory();
  }, [refreshHistory]);

  const submit = useCallback(
    async (file: File) => {
      if (file.size > maxBytes) {
        toast.error(`${file.name} is larger than the ${fmtSize(maxBytes)} limit`);
        return;
      }
      setScanning(true);
      setResult(null);
      try {
        const scan = await vtAPI.scan(file);
        setResult(scan);
        if (scan.verdict === 'MALICIOUS') {
          toast.error(`${scan.malicious} engines flagged ${scan.fileName}`);
        } else if (scan.verdict === 'CLEAN') {
          toast.success(`${scan.fileName} is clean`);
        }
        refreshHistory();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'scan failed');
      } finally {
        setScanning(false);
      }
    },
    [maxBytes, refreshHistory],
  );

  async function runLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!indicator.trim()) return;
    setLookingUp(true);
    setReport(null);
    try {
      setReport(await vtAPI.lookup(indicator.trim()));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'lookup failed');
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <div className="container mx-auto px-6 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-accent-cyan/80 font-medium">
          Threat intelligence
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Malware <span className="text-gradient-animated">Scanner</span>
        </h1>
        <p className="mt-3 text-sm text-white/60 max-w-2xl">
          Check a file against 70 antivirus engines through VirusTotal. The file
          is hashed locally first and looked up by SHA-256, so a sample anyone
          has seen before is answered without uploading anything. Malicious
          verdicts raise an alert and land in the SIEM log alongside network
          detections.
        </p>
      </header>

      {configured === false && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 text-sm text-accent-yellow">
          <strong className="font-semibold">No API key configured.</strong> Get a
          free key at{' '}
          <a
            href="https://www.virustotal.com/gui/join-us"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            virustotal.com
          </a>
          , then start the backend with it set:
          <code className="block mt-2 font-mono text-xs text-white/70">
            $env:VIRUSTOTAL_API_KEY=&quot;your-key&quot;; .\mvnw.cmd spring-boot:run
          </code>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) submit(file);
            }}
            className={`glass rounded-2xl border-2 border-dashed p-10 text-center transition ${
              dragging
                ? 'border-accent-cyan/60 bg-accent-cyan/5'
                : 'border-white/10 hover:border-white/20'
            }`}
          >
            <div className="text-4xl mb-3">🧪</div>
            <p className="font-medium">
              {scanning ? 'Scanning…' : 'Drop a file here, or'}{' '}
              {!scanning && (
                <button
                  onClick={() => fileInput.current?.click()}
                  className="text-accent-cyan hover:underline"
                  disabled={configured === false}
                >
                  browse
                </button>
              )}
            </p>
            <p className="text-xs text-white/40 mt-2">
              Up to {fmtSize(maxBytes)}. A first-time upload can take a minute
              while the engines run.
            </p>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) submit(file);
                e.target.value = '';
              }}
            />
            {scanning && (
              <div className="mt-4 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-accent-cyan to-accent-blue animate-pulse" />
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border ${VERDICT_STYLE[result.verdict].chip}`}
                    >
                      {VERDICT_STYLE[result.verdict].icon}{' '}
                      {VERDICT_STYLE[result.verdict].label}
                    </span>
                    <h3 className="font-display font-semibold truncate">
                      {result.fileName}
                    </h3>
                    {result.cached && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50"
                        title="Answered from a previous scan of the same hash — no API call spent"
                      >
                        cached
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-1 font-mono break-all">
                    {result.sha256}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold font-display">
                    {result.malicious + result.suspicious}
                    <span className="text-white/40 text-base">/{result.engineCount}</span>
                  </div>
                  <div className="text-[11px] text-white/40">engines flagged it</div>
                </div>
              </div>

              {result.errorMessage ? (
                <p className="mt-4 text-sm text-red-300">{result.errorMessage}</p>
              ) : (
                <>
                  <div className="mt-4">
                    <EngineBar scan={result} />
                    <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-white/50">
                      <span className="text-red-300">{result.malicious} malicious</span>
                      <span className="text-accent-yellow">{result.suspicious} suspicious</span>
                      <span className="text-accent-green">{result.harmless} harmless</span>
                      <span>{result.undetected} undetected</span>
                      <span className="ml-auto">{fmtSize(result.sizeBytes)}</span>
                    </div>
                  </div>

                  {result.threatLabel && (
                    <p className="mt-4 text-sm">
                      <span className="text-white/50">Identified as </span>
                      <span className="font-mono text-red-300">{result.threatLabel}</span>
                    </p>
                  )}

                  {result.detections && (
                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-widest text-white/40 mb-2">
                        Engine detections
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.detections.split('; ').map((d) => (
                          <span
                            key={d}
                            className="text-[11px] font-mono px-2 py-1 rounded bg-red-500/10 text-red-200/90 border border-red-500/20"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.permalink && (
                    <a
                      href={result.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-4 text-xs text-accent-cyan hover:underline"
                    >
                      Full report on VirusTotal →
                    </a>
                  )}
                </>
              )}
            </div>
          )}

          {/* History */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h3 className="font-display font-semibold">Recent scans</h3>
              <p className="text-xs text-white/50 mt-0.5">
                Stored as hash + verdict only — the files themselves are never kept.
              </p>
            </div>
            <div className="divide-y divide-white/5">
              {history.map((s) => (
                <div
                  key={s.id}
                  className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${VERDICT_STYLE[s.verdict].chip}`}
                      >
                        {VERDICT_STYLE[s.verdict].label}
                      </span>
                      <span className="text-sm truncate">{s.fileName}</span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {fmtTime(s.submittedAt)} · {fmtSize(s.sizeBytes)}
                      {s.submittedBy ? ` · ${s.submittedBy}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-white/50 shrink-0 font-mono">
                    {s.malicious}/{s.engineCount}
                  </span>
                </div>
              ))}
              {history.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-white/40">
                  No scans yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Indicator lookup */}
        <aside className="lg:col-span-1">
          <div className="glass rounded-2xl p-6 lg:sticky lg:top-24">
            <h3 className="font-display font-semibold">Indicator lookup</h3>
            <p className="text-xs text-white/50 mt-1">
              Check an attacker IP, a domain, a URL or a file hash. Handy for the
              source IPs on the Attack Stream.
            </p>
            <form onSubmit={runLookup} className="mt-4 flex gap-2">
              <input
                value={indicator}
                onChange={(e) => setIndicator(e.target.value)}
                placeholder="8.8.8.8 / example.com / hash"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/30 border border-white/10 focus:border-accent-cyan/50 outline-none text-sm font-mono"
              />
              <button
                type="submit"
                disabled={lookingUp || configured === false}
                className="px-3 py-2 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-primary-dark font-semibold text-sm disabled:opacity-60"
              >
                {lookingUp ? '…' : 'Check'}
              </button>
            </form>

            {report && (
              <div className="mt-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${VERDICT_STYLE[report.verdict].chip}`}
                  >
                    {VERDICT_STYLE[report.verdict].label}
                  </span>
                  <span className="text-xs text-white/50 uppercase tracking-wider">
                    {report.kind}
                  </span>
                </div>
                <p className="mt-2 font-mono text-sm break-all">{report.indicator}</p>
                {report.summary && (
                  <p className="text-xs text-white/50 mt-1">{report.summary}</p>
                )}
                <div className="mt-3">
                  <EngineBar scan={report} />
                  <p className="text-[11px] text-white/50 mt-2">
                    {report.malicious} malicious · {report.suspicious} suspicious ·{' '}
                    {report.harmless} harmless
                    {report.reputation != null && ` · reputation ${report.reputation}`}
                  </p>
                </div>
                {report.detections.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {report.detections.map((d) => (
                      <span
                        key={d}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-200/90 border border-red-500/20"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
                {report.permalink && (
                  <a
                    href={report.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-3 text-xs text-accent-cyan hover:underline"
                  >
                    Open in VirusTotal →
                  </a>
                )}
              </div>
            )}

            <p className="mt-6 text-[11px] text-white/35 leading-relaxed">
              The free API allows 4 requests a minute and 500 a day. Uploading a
              file shares it with VirusTotal and its partners, so never submit
              confidential documents — look them up by hash instead.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
