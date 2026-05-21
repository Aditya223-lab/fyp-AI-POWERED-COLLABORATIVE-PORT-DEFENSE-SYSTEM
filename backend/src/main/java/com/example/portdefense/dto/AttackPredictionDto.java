package com.example.portdefense.dto;

import java.time.Instant;
import java.util.List;

public record AttackPredictionDto(
        Instant timestamp,
        int predictedCount,
        double confidence,
        List<String> likelySources,
        List<Integer> targetPorts,
        List<String> recommendedActions
) {
}
