// Threat related types
export interface ThreatEvent {
  id: string;
  sourceIP: string;
  targetPort: number;
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

// Monitored target — a Docker container or host the Python detector probes.
export interface MonitorTarget {
  id: string;
  name: string;
  ipAddress: string;
  ports: string;
  organizationId?: string | null;
  createdAt: Date;
  lastScannedAt?: Date | null;
  lastFindingsCount: number;
}