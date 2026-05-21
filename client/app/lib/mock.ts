import type { Severity } from '@/types';

// Style lookup only — data now comes from the Spring backend via @/lib/api.
export const severityColor: Record<Severity, string> = {
  low: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  medium: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30',
  high: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  critical: 'text-red-300 bg-red-500/10 border-red-500/30',
};
