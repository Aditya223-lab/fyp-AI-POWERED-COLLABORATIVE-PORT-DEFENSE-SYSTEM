package com.example.portdefense.dto;

import com.example.portdefense.domain.ScanType;
import com.example.portdefense.domain.Severity;
import java.time.Instant;

public record ThreatEventDto(
        String id,
        String sourceIP,
        int targetPort,
        String targetIp,
        String targetService,
        Instant timestamp,
        Severity severity,
        ScanType scanType,
        String attackType,
        double anomalyScore,
        String organizationId,
        String organizationName,
        LocationDto location,
        boolean isZeroDay,
        double confidence,
        Integer responseTime,
        String reviewStatus,
        String reviewedBy
) {
}
