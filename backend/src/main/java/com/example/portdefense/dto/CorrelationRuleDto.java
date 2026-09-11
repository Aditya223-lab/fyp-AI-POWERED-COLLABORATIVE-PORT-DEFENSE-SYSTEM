package com.example.portdefense.dto;

import com.example.portdefense.domain.CorrelationRule;
import java.time.Instant;

public record CorrelationRuleDto(
        String id,
        String name,
        String description,
        String source,
        String eventType,
        String distinctField,
        int threshold,
        int windowSeconds,
        String severity,
        boolean enabled,
        Instant lastTriggeredAt,
        long triggerCount
) {
    public static CorrelationRuleDto of(CorrelationRule r) {
        return new CorrelationRuleDto(
                r.getId(), r.getName(), r.getDescription(), r.getSource(),
                r.getEventType(), r.getDistinctField(), r.getThreshold(),
                r.getWindowSeconds(), r.getSeverity(), r.isEnabled(),
                r.getLastTriggeredAt(), r.getTriggerCount());
    }
}
