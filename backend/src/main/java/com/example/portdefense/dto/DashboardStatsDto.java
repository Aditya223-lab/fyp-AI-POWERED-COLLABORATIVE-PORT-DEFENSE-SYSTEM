package com.example.portdefense.dto;

public record DashboardStatsDto(
        long totalThreats,
        long totalOrganizations,
        long activeThreats,
        long averageResponseTime,
        long predictedAttacks,
        double detectionRate,
        double falsePositiveRate,
        double collaborationScore,
        long federatedLearningRound
) {
}
