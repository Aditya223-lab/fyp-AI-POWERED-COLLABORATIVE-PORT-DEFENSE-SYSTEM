import { getSession } from 'next-auth/react';
import type {
  Alert,
  AttackPrediction,
  BlockedIp,
  CollaborativeInsight,
  CorrelationRule,
  DashboardStats,
  FileScan,
  IndicatorReport,
  LogEvent,
  MonitorTarget,
  Organization,
  Report,
  SeverityCounts,
  TargetCheck,
  TargetType,
  ThreatEvent,
  ThreatStatistics,
} from '@/types';

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';

export const SSE_URL =
  process.env.NEXT_PUBLIC_SSE_URL || `${BASE}/events/threats`;

// Live asset-monitor stream: one "asset" event per completed real check.
export const ASSET_SSE_URL = `${BASE}/events/assets`;

// next-auth's getSession() hits /api/auth/session once per call but the route
// is debounced internally, so this is cheap. Server components can't call it,
// but every consumer of this module is a client component today.
async function authHeaders(): Promise<HeadersInit> {
  if (typeof window === 'undefined') return {};
  try {
    const session = await getSession();
    if (session?.accessToken) {
      return { Authorization: `Bearer ${session.accessToken}` };
    }
  } catch {
    // Session fetch failures should not block public endpoints.
  }
  return {};
}

async function getJSON<T>(path: string): Promise<T> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', ...auth },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new ApiError(`GET ${path} → HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...auth },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(`POST ${path} → HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

async function patchJSON<T>(path: string, body: unknown): Promise<T> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...auth },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(`PATCH ${path} → HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

async function deleteJSON(path: string): Promise<void> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: { ...auth } });
  if (!res.ok && res.status !== 204) {
    throw new ApiError(`DELETE ${path} → HTTP ${res.status}`, res.status);
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// --- Normalizers: backend sends ISO strings; we want Date instances ---

function parseThreat(t: ThreatEvent): ThreatEvent {
  return { ...t, timestamp: new Date(t.timestamp) };
}

function parseOrg(o: Organization): Organization {
  return {
    ...o,
    joinedDate: new Date(o.joinedDate),
    lastActive: new Date(o.lastActive),
    ipAddresses: Array.isArray(o.ipAddresses) ? o.ipAddresses : [],
  };
}

function parseAlert(a: Alert): Alert {
  return { ...a, timestamp: new Date(a.timestamp) };
}

function parsePrediction(p: AttackPrediction): AttackPrediction {
  return { ...p, timestamp: new Date(p.timestamp) };
}

function parseInsight(i: CollaborativeInsight): CollaborativeInsight {
  return { ...i, timestamp: new Date(i.timestamp) };
}

// --- Typed endpoint groups ---

export const dashboardAPI = {
  stats: () => getJSON<DashboardStats>('/dashboard/stats'),
  recentThreats: (limit = 50) =>
    getJSON<ThreatEvent[]>(`/dashboard/threats/recent?limit=${limit}`).then(
      (xs) => xs.map(parseThreat),
    ),
  alerts: () => getJSON<Alert[]>('/dashboard/alerts').then((xs) => xs.map(parseAlert)),
  predictions: () =>
    getJSON<AttackPrediction[]>('/dashboard/predictions').then((xs) =>
      xs.map(parsePrediction),
    ),
};

export const threatAPI = {
  all: () => getJSON<ThreatEvent[]>('/threats').then((xs) => xs.map(parseThreat)),
  byId: (id: string) =>
    getJSON<ThreatEvent>(`/threats/${id}`).then(parseThreat),
  statistics: (
    timeframe: 'hour' | 'day' | 'week' = 'day',
    orgIds?: string[],
  ) => {
    const qs =
      orgIds && orgIds.length > 0
        ? `?orgIds=${encodeURIComponent(orgIds.join(','))}`
        : '';
    return getJSON<ThreatStatistics>(`/threats/statistics/${timeframe}${qs}`);
  },
  heatmap: () => getJSON<unknown[]>('/threats/heatmap'),
  // Analyst review: CONFIRMED / FALSE_POSITIVE, or UNREVIEWED to clear.
  review: (id: string, status: 'CONFIRMED' | 'FALSE_POSITIVE' | 'UNREVIEWED') =>
    patchJSON<ThreatEvent>(`/threats/${id}/review`, { status }).then(parseThreat),
  remove: (id: string) => deleteJSON(`/threats/${id}`),
};

// Alerts management (admin). GET is public; writes need an admin session token.
export const alertAPI = {
  all: () => getJSON<Alert[]>('/alerts').then((xs) => xs.map(parseAlert)),
  setStatus: (id: string, status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED') =>
    patchJSON<Alert>(`/alerts/${id}`, { status }).then(parseAlert),
  remove: (id: string) => deleteJSON(`/alerts/${id}`),
};

function parseLogEvent(e: LogEvent): LogEvent {
  return { ...e, timestamp: new Date(e.timestamp) };
}

function parseRule(r: CorrelationRule): CorrelationRule {
  return {
    ...r,
    lastTriggeredAt: r.lastTriggeredAt ? new Date(r.lastTriggeredAt) : null,
  };
}

// SIEM log events. GET is public; ingestion is done by the Python log shippers.
export type LogSearch = {
  source?: string;
  eventType?: string;
  sourceIP?: string;
  q?: string;
  limit?: number;
};

export const logAPI = {
  search: (opts: LogSearch = {}) => {
    const qs = new URLSearchParams();
    if (opts.source) qs.set('source', opts.source);
    if (opts.eventType) qs.set('eventType', opts.eventType);
    if (opts.sourceIP) qs.set('sourceIP', opts.sourceIP);
    if (opts.q) qs.set('q', opts.q);
    qs.set('limit', String(opts.limit ?? 200));
    return getJSON<LogEvent[]>(`/logs?${qs.toString()}`).then((xs) =>
      xs.map(parseLogEvent),
    );
  },
};

// Correlation rules. Reading the list is public; toggling is ROLE_ADMIN-gated.
export const ruleAPI = {
  all: () => getJSON<CorrelationRule[]>('/rules').then((xs) => xs.map(parseRule)),
  setEnabled: (id: string, enabled: boolean) =>
    patchJSON<CorrelationRule>(`/rules/${id}`, { enabled }).then(parseRule),
};

export type CreateOrgInput = {
  name: string;
  industry: Organization['industry'];
  memberCount?: number;
  ownerEmail?: string | null;
  ipAddresses?: string[];
};

// All fields optional: only the supplied ones get updated.
export type UpdateOrgInput = {
  name?: string;
  industry?: Organization['industry'];
  status?: Organization['status'];
  memberCount?: number;
  ownerEmail?: string | null;
  ipAddresses?: string[];
};

export const orgAPI = {
  all: () => getJSON<Organization[]>('/organizations').then((xs) => xs.map(parseOrg)),
  byId: (id: string) =>
    getJSON<Organization>(`/organizations/${id}`).then(parseOrg),
  byOwner: (email: string) =>
    getJSON<Organization[]>(
      `/organizations/by-owner/${encodeURIComponent(email)}`,
    ).then((xs) => xs.map(parseOrg)),
  threatsFor: (id: string) =>
    getJSON<ThreatEvent[]>(`/organizations/${id}/threats`).then((xs) =>
      xs.map(parseThreat),
    ),
  insights: () =>
    getJSON<CollaborativeInsight[]>('/organizations/insights').then((xs) =>
      xs.map(parseInsight),
    ),
  severityStats: (id: string) =>
    getJSON<Record<string, number>>(`/organizations/${id}/severity-stats`).then(
      (raw) => ({
        low: Number(raw.LOW ?? raw.low ?? 0),
        medium: Number(raw.MEDIUM ?? raw.medium ?? 0),
        high: Number(raw.HIGH ?? raw.high ?? 0),
        critical: Number(raw.CRITICAL ?? raw.critical ?? 0),
      }) as SeverityCounts,
    ),
  alertsFor: (id: string) =>
    getJSON<Alert[]>(`/organizations/${id}/alerts`).then((xs) =>
      xs.map(parseAlert),
    ),
  create: (input: CreateOrgInput) =>
    postJSON<Organization>('/organizations', {
      name: input.name,
      industry: input.industry,
      memberCount: input.memberCount,
      ownerEmail: input.ownerEmail ?? null,
      ipAddresses: input.ipAddresses ?? [],
    }).then(parseOrg),
  setOwner: (id: string, ownerEmail: string | null) =>
    patchJSON<Organization>(`/organizations/${id}/owner`, { ownerEmail }).then(
      parseOrg,
    ),
  // Provision a personal demo org for a just-upgraded Premium customer so
  // /attacks has data immediately. Idempotent server-side.
  provisionDemo: (ownerEmail: string) =>
    postJSON<Organization>('/organizations/provision-demo', { ownerEmail }).then(
      parseOrg,
    ),
  setIps: (id: string, ipAddresses: string[]) =>
    patchJSON<Organization>(`/organizations/${id}/ips`, { ipAddresses }).then(
      parseOrg,
    ),
  update: (id: string, input: UpdateOrgInput) =>
    patchJSON<Organization>(`/organizations/${id}`, input).then(parseOrg),
  remove: (id: string) => deleteJSON(`/organizations/${id}`),
};

function parseTarget(t: MonitorTarget): MonitorTarget {
  return {
    ...t,
    createdAt: new Date(t.createdAt),
    lastCheckedAt: t.lastCheckedAt ? new Date(t.lastCheckedAt) : null,
    tlsExpiresAt: t.tlsExpiresAt ? new Date(t.tlsExpiresAt) : null,
    lastScannedAt: t.lastScannedAt ? new Date(t.lastScannedAt) : null,
  };
}

function parseCheck(c: TargetCheck): TargetCheck {
  return { ...c, checkedAt: new Date(c.checkedAt) };
}

export type CreateTargetInput = {
  name: string;
  type: TargetType;
  // A URL for a website, an IP or hostname for a computer.
  address: string;
  ports?: string;
  organizationId?: string;
  ownerEmail?: string | null;
  checkIntervalSeconds?: number;
  // The caller confirms they own the asset or may probe it. The backend
  // rejects the request when this is explicitly false.
  authorized: boolean;
};

// PATCH body: only supplied fields change.
export type UpdateTargetInput = {
  name?: string;
  address?: string;
  ports?: string;
  enabled?: boolean;
  checkIntervalSeconds?: number;
};

export const targetAPI = {
  // No ownerEmail → every asset (admin). With one → that customer's assets
  // plus the shared demo ones.
  all: (ownerEmail?: string | null) => {
    const qs = ownerEmail
      ? `?ownerEmail=${encodeURIComponent(ownerEmail)}`
      : '';
    return getJSON<MonitorTarget[]>(`/targets${qs}`).then((xs) => xs.map(parseTarget));
  },
  create: (input: CreateTargetInput) =>
    postJSON<MonitorTarget>('/targets', input).then(parseTarget),
  update: (id: string, input: UpdateTargetInput) =>
    patchJSON<MonitorTarget>(`/targets/${id}`, input).then(parseTarget),
  remove: (id: string) => deleteJSON(`/targets/${id}`),
  // Probe now instead of waiting for the next interval.
  checkNow: (id: string) =>
    postJSON<MonitorTarget>(`/targets/${id}/check`, {}).then(parseTarget),
  history: (id: string, limit = 60) =>
    getJSON<TargetCheck[]>(`/targets/${id}/history?limit=${limit}`).then((xs) =>
      xs.map(parseCheck),
    ),
};

function parseBlock(b: BlockedIp): BlockedIp {
  return {
    ...b,
    createdAt: new Date(b.createdAt),
    removedAt: b.removedAt ? new Date(b.removedAt) : null,
  };
}

// Active response — blocking IPs at the host firewall. Admin only.
export const responseAPI = {
  blocks: () =>
    getJSON<BlockedIp[]>('/response/blocks').then((xs) => xs.map(parseBlock)),
  block: (input: {
    ip: string;
    reason?: string;
    source?: 'MANUAL' | 'ALERT' | 'THREAT';
    organizationId?: string;
  }) => postJSON<BlockedIp>('/response/block', input).then(parseBlock),
  unblock: (id: string) =>
    deleteJSON(`/response/block/${id}`),
};

function parseScan(s: FileScan): FileScan {
  return { ...s, submittedAt: new Date(s.submittedAt) };
}

// VirusTotal-backed malware scanning. Uploads go through our backend so the
// API key never reaches the browser.
export const vtAPI = {
  status: () => getJSON<{ configured: boolean; maxFileBytes: number }>('/vt/status'),
  history: (limit = 50) =>
    getJSON<FileScan[]>(`/vt/scans?limit=${limit}`).then((xs) => xs.map(parseScan)),
  lookup: (indicator: string) =>
    postJSON<IndicatorReport>('/vt/lookup', { indicator }),
  scan: async (file: File, rescan = false) => {
    const auth = await authHeaders();
    const form = new FormData();
    form.append('file', file);
    // No Content-Type header: the browser must set the multipart boundary.
    const res = await fetch(`${BASE}/vt/scan?rescan=${rescan}`, {
      method: 'POST',
      headers: { ...auth },
      body: form,
    });
    if (!res.ok) {
      // The backend returns {"error": "..."} with a readable explanation.
      const detail = await res
        .json()
        .then((b: { error?: string }) => b?.error)
        .catch(() => undefined);
      throw new ApiError(detail ?? `POST /vt/scan → HTTP ${res.status}`, res.status);
    }
    return parseScan((await res.json()) as FileScan);
  },
};

// Contact form — the Spring backend relays the message to the admin inbox
// via JavaMailSender (Gmail SMTP). Requires a signed-in session; the backend
// reads the sender's identity from the JWT, so only subject/message travel.
export const contactAPI = {
  send: async (subject: string, message: string) => {
    const auth = await authHeaders();
    const res = await fetch(`${BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...auth },
      body: JSON.stringify({ subject, message }),
    });
    if (!res.ok) {
      // The backend answers {"error": "contact_mail_disabled" | "mail_send_failed", ...}.
      const detail = await res
        .json()
        .then((b: { error?: string; detail?: string }) => b?.detail || b?.error)
        .catch(() => undefined);
      throw new ApiError(detail ?? `POST /contact → HTTP ${res.status}`, res.status);
    }
    return res.json() as Promise<{ status: string }>;
  },
};

function parseReport(r: Report): Report {
  return { ...r, generatedAt: new Date(r.generatedAt) };
}

export type GenerateReportInput = {
  title?: string;
  type?: 'FEDERATION_SNAPSHOT' | 'PER_ORG' | 'USER_PORTFOLIO';
  generatedBy?: string;
  organizationId?: string;
  ownerEmail?: string;
};

export const reportAPI = {
  list: (opts?: { generatedBy?: string }) => {
    const qs = opts?.generatedBy
      ? `?generatedBy=${encodeURIComponent(opts.generatedBy)}`
      : '';
    return getJSON<Report[]>(`/reports${qs}`).then((xs) => xs.map(parseReport));
  },
  generate: (input: GenerateReportInput = {}) =>
    postJSON<Report>('/reports', input).then(parseReport),
  remove: (id: string) => deleteJSON(`/reports/${id}`),
  downloadUrl: (id: string, format: 'html' | 'json' = 'html') =>
    `${BASE}/reports/${id}/download?format=${format}`,
};

export const api = {
  contactAPI,
  dashboardAPI,
  threatAPI,
  orgAPI,
  targetAPI,
  reportAPI,
  alertAPI,
  logAPI,
  ruleAPI,
  vtAPI,
  responseAPI,
};
