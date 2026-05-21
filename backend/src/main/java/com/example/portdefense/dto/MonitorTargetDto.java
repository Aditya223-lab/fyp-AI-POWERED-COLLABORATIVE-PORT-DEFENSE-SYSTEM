package com.example.portdefense.dto;

import java.time.Instant;

public record MonitorTargetDto(
        String id,
        String name,
        String ipAddress,
        String ports,
        String organizationId,
        Instant createdAt,
        Instant lastScannedAt,
        int lastFindingsCount
) {
}
