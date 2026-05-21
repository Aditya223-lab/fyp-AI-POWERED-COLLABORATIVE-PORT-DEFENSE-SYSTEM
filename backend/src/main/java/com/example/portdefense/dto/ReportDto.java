package com.example.portdefense.dto;

import java.time.Instant;

// Lightweight metadata returned by list endpoints — the heavy HTML/JSON
// payloads are only sent through the /download endpoint.
public record ReportDto(
        String id,
        String title,
        String type,
        Instant generatedAt,
        String generatedBy,
        long totalThreats,
        long totalOrgs,
        long totalAlerts,
        String summary
) {
}
