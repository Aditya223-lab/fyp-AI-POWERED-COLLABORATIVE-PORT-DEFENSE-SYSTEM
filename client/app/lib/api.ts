import type {
  Alert,
  AttackPrediction,
  CollaborativeInsight,
  DashboardStats,
  MonitorTarget,
  Organization,
  Report,
  SeverityCounts,
  ThreatEvent,
  ThreatStatistics,
} from '@/types';

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';

export const SSE_URL =
  process.env.NEXT_PUBLIC_SSE_URL || `${BASE}/events/threats`;

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new ApiError(`GET ${path} → HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(`POST ${path} → HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

async function patchJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(`PATCH ${path} → HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

async function deleteJSON(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
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
    lastScannedAt: t.lastScannedAt ? new Date(t.lastScannedAt) : null,
  };
}

export type CreateTargetInput = {
  name: string;
  ipAddress: string;
  ports: string;
  organizationId?: string;
};

export const targetAPI = {
  all: () => getJSON<MonitorTarget[]>('/targets').then((xs) => xs.map(parseTarget)),
  create: (input: CreateTargetInput) =>
    postJSON<MonitorTarget>('/targets', input).then(parseTarget),
  remove: (id: string) => deleteJSON(`/targets/${id}`),
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

export const api = { dashboardAPI, threatAPI, orgAPI, targetAPI, reportAPI };
