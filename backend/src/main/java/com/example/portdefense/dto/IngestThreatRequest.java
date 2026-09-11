package com.example.portdefense.dto;

import com.example.portdefense.domain.ScanType;
import com.example.portdefense.domain.Severity;

public record IngestThreatRequest(
        String sourceIP,
        Integer targetPort,
        String targetIp,          // the asset that was hit, when known
        String targetService,
        Severity severity,
        ScanType scanType,
        String attackType,
        Double anomalyScore,
        String organizationId,
        Boolean isZeroDay,
        Double confidence,
        Integer responseTime,
        LocationDto location
) {
}
