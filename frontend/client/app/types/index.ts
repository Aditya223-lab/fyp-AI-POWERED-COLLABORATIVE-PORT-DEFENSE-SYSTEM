// Threat related types
export interface ThreatEvent {
  id: string;
  sourceIP: string;
  targetPort: number;
  targetIp?: string | null; // the asset that was hit, when the attack names one
  targetService?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  scanType: 'syn' | 'udp' | 'connect' | 'fin' | 'null' | 'xmas' | 'ack';
  attackType?: string; // AI-predicted family: PortScan, DoS, DDoS, BruteForce, ...
  anomalyScore: number;
  organizationId: string;
  organizationName: string;
  location?: {
    lat: number;
    lng: number;
    country: string;
    city: string;
  };
  isZeroDay: boolean;
  confidence: number;
  responseTime?: number;
  // Analyst review of the AI's call, set from the admin UI.
  reviewStatus?: 'CONFIRMED' | 'FALSE_POSITIVE' | null;
  reviewedBy?: string | null;
}

export interface ThreatStatistics {
  total: number;
  bySeverity: Record<Severity, number>;
  byType: Record<ScanType, number>;
  byHour: number[];
  trend: 'increasing' | 'decreasing' | 'stable';
  averageSeverity: number;
  zeroDayCount: number;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  industry: 'finance' | 'healthcare' | 'education' | 'technology' | 'government' | 'other';
  status: 'active' | 'warning' | 'critical' | 'offline';
  threatLevel: number; // 0-100
  memberCount: number;
  joinedDate: Date;
  lastActive: Date;
  threatScore: number;
  detectedAttacks: number;
  blockedAttacks: number;
  ownerEmail?: string | null;
  ipAddresses: string[];
}

export type SeverityCounts = Record<Severity, number>;

// Admin-facing customer record (read from .data/users.json).
export interface CustomerRecord {
  email: string;
  plan: 'free' | 'premium';
  upgradedAt?: string;
  hasPassword?: boolean;
}

// Dashboard types
export interface DashboardStats {
  totalThreats: number;
  totalOrganizations: number;
  activeThreats: number;
  averageResponseTime: number; // milliseconds
  predictedAttacks: number;
  detectionRate: number; // percentage
  falsePositiveRate: number;
  collaborationScore: number;
  federatedLearningRound: number;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  isRead: boolean;
  source: string;
  actionRequired: boolean;
  organizationId?: string | null;
  // Incident-response lifecycle set from the admin Alerts panel.
  status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
}

// A normalized SIEM log event collected from an external source.
export interface LogEvent {
  id: string;
  timestamp: Date;
  source: string; // ssh | web | firewall | system
  eventType: string; // auth_failure | http_attack | connection_denied | ...
  sourceIP?: string | null;
  username?: string | null;
  targetPort?: number | null;
  statusCode?: number | null;
  message?: string | null;
  rawLine?: string | null;
  organizationId?: string | null;
}

// A SIEM correlation rule the engine evaluates over log events.
export interface CorrelationRule {
  id: string;
  name: string;
  description?: string | null;
  source?: string | null;
  eventType: string;
  distinctField?: string | null;
  threshold: number;
  windowSeconds: number;
  severity: string;
  enabled: boolean;
  lastTriggeredAt?: Date | null;
  triggerCount: number;
}


export interface Report {
  id: string;
  title: string;
  type: string;
  generatedAt: Date;
  generatedBy?: string | null;
  totalThreats: number;
  totalOrgs: number;
  totalAlerts: number;
  summary?: string | null;
}

// ML Prediction types
export interface AttackPrediction {
  timestamp: Date;
  predictedCount: number;
  confidence: number;
  likelySources: string[];
  targetPorts: number[];
  recommendedActions: string[];
}

// Collaboration types
export interface CollaborativeInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'trend' | 'recommendation';
  content: string;
  organizations: string[];
  confidence: number;
  timestamp: Date;
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type ScanType = 'syn' | 'udp' | 'connect' | 'fin' | 'null' | 'xmas' | 'ack';

export type TargetType = 'WEBSITE' | 'HOST';
export type TargetStatus = 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

// A real monitored asset: a website (checked over HTTP) or a computer/server
// (checked with TCP connects). Everything from `status` down is written by the
// backend's AssetMonitorService after each real probe.
export interface MonitorTarget {
  id: string;
  name: string;
  type: TargetType;
  ipAddress: string; // the IP actually probed — resolved live for websites
  hostname?: string | null;
  url?: string | null;
  ports: string;
  organizationId?: string | null;
  ownerEmail?: string | null;
  createdAt: Date;
  // live monitoring
  enabled: boolean;
  checkIntervalSeconds: number;
  status: TargetStatus;
  lastCheckedAt?: Date | null;
  resolvedIps?: string | null; // comma-separated A records from the last lookup
  latencyMs?: number | null;
  httpStatus?: number | null;
  openPorts?: string | null;
  tlsExpiresAt?: Date | null;
  lastError?: string | null;
  checksTotal: number;
  checksUp: number;
  uptimePercent: number;
  consecutiveFailures: number;
  // python scanner
  lastScannedAt?: Date | null;
  lastFindingsCount: number;
}

// An IP blocked at the host firewall of the machine running the backend.
export interface BlockedIp {
  id: string;
  ipAddress: string;
  reason?: string | null;
  source?: string | null; // MANUAL | ALERT | THREAT
  status: 'ACTIVE' | 'REMOVED';
  enforcement: 'ENFORCED' | 'SIMULATED';
  detail?: string | null;
  createdBy?: string | null;
  createdAt: Date;
  removedAt?: Date | null;
  organizationId?: string | null;
}

export type ScanVerdict = 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS' | 'UNKNOWN' | 'ERROR';

// A file submitted to VirusTotal. The file itself is never stored — only its
// hash and the verdict the engines returned.
export interface FileScan {
  id: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  contentType?: string | null;
  submittedAt: Date;
  submittedBy?: string | null;
  verdict: ScanVerdict;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  engineCount: number;
  threatLabel?: string | null;
  detections?: string | null; // "Kaspersky: Trojan…; ESET: …"
  permalink?: string | null;
  errorMessage?: string | null;
  cached: boolean; // answered from our own table, no API call spent
}

// Reputation of an IP, domain, URL or hash.
export interface IndicatorReport {
  indicator: string;
  kind: 'ip' | 'domain' | 'url' | 'hash';
  verdict: ScanVerdict;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  summary?: string | null;
  reputation?: number | null;
  detections: string[];
  permalink?: string | null;
}

// One historical probe of an asset (newest first from the API).
export interface TargetCheck {
  checkedAt: Date;
  status: TargetStatus;
  latencyMs: number; // -1 when nothing answered
  httpStatus?: number | null;
  openPortCount: number;
  detail?: string | null;
}