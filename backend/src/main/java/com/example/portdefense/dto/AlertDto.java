package com.example.portdefense.dto;

import com.example.portdefense.domain.AlertSeverity;
import java.time.Instant;

public record AlertDto(
        String id,
        String title,
        String description,
        AlertSeverity severity,
        Instant timestamp,
        boolean isRead,
        String source,
        boolean actionRequired,
        String organizationId
) {
}
