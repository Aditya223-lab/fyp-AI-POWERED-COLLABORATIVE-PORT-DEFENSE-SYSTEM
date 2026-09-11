package com.example.portdefense.dto;

import java.time.Instant;

// One normalized log event posted by a shipper. The shipper may send a single
// object or a JSON array of these to /api/logs/ingest. timestamp is optional
// (defaults to now); organizationId is optional.
public record IngestLogRequest(
        Instant timestamp,
        String source,
        String eventType,
        String sourceIP,
        String username,
        Integer targetPort,
        Integer statusCode,
        String message,
        String rawLine,
        String organizationId
) {
}
