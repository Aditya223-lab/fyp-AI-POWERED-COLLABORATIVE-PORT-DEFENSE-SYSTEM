package com.example.portdefense.dto;

import com.example.portdefense.domain.ScanType;
import com.example.portdefense.domain.Severity;
import java.util.List;
import java.util.Map;

public record ThreatStatisticsDto(
        long total,
        Map<Severity, Long> bySeverity,
        Map<ScanType, Long> byType,
        List<Long> byHour,
        String trend,
        double averageSeverity,
        long zeroDayCount
) {
}
