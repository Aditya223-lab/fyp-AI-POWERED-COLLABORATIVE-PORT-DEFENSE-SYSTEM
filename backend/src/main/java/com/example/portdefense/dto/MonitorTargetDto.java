package com.example.portdefense.dto;

import java.time.Instant;

/**
 * A monitored asset as the dashboard sees it. Everything from `status` down is
 * live state written by AssetMonitorService's real probes.
 */
public record MonitorTargetDto(
        String id,
        String name,
        String type,             // WEBSITE | HOST
        String ipAddress,        // the IP actually probed (resolved for websites)
        String hostname,         // DNS name, when there is one
        String url,              // full URL for websites
        String ports,
        String organizationId,
        String ownerEmail,
        Instant createdAt,
        // --- live monitoring ---
        boolean enabled,
        int checkIntervalSeconds,
        String status,           // UP | DEGRADED | DOWN | UNKNOWN
        Instant lastCheckedAt,
        String resolvedIps,
        Integer latencyMs,
        Integer httpStatus,
        String openPorts,
        Instant tlsExpiresAt,
        String lastError,
        long checksTotal,
        long checksUp,
        double uptimePercent,
        int consecutiveFailures,
        // --- python scanner ---
        Instant lastScannedAt,
        int lastFindingsCount
) {
}
