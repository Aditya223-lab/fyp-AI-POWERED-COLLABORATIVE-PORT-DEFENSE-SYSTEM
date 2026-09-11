package com.example.portdefense.dto;

public record BlockRequest(
        String ip,
        String reason,
        String source,          // MANUAL | ALERT | THREAT (default MANUAL)
        String organizationId
) {
}
