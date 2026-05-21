package com.example.portdefense.dto;

import com.example.portdefense.domain.InsightType;
import java.time.Instant;
import java.util.List;

public record CollaborativeInsightDto(
        String id,
        InsightType type,
        String content,
        List<String> organizations,
        double confidence,
        Instant timestamp
) {
}
