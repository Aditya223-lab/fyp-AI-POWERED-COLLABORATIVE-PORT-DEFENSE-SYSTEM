package com.example.portdefense.dto;

import java.time.Instant;

public record LogEventDto(
        String id,
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
