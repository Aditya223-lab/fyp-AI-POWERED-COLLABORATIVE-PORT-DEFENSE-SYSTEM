package com.example.portdefense.dto;

import java.time.Instant;

public record BlockedIpDto(
        String id,
        String ipAddress,
        String reason,
        String source,
        String status,          // ACTIVE | REMOVED
        String enforcement,     // ENFORCED | SIMULATED
        String detail,
        String createdBy,
        Instant createdAt,
        Instant removedAt,
        String organizationId
) {
}
