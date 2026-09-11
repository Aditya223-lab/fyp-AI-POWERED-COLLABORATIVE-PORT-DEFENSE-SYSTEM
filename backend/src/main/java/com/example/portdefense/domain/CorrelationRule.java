package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A SIEM correlation rule: "if COUNT of {eventType} events (optionally distinct
 * by {distinctField}) from one source IP within {windowSeconds} reaches
 * {threshold}, raise an alert of {severity}". Evaluated on a schedule by
 * CorrelationService. This is the rule-based half of the hybrid detection —
 * complementing the ML model.
 */
@Entity
@Table(name = "correlation_rules")
public class CorrelationRule {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(length = 512)
    private String description;

    // Optional source filter (ssh/web/firewall). Null = any source.
    @Column(length = 32)
    private String source;

    @Column(nullable = false, length = 40)
    private String eventType;

    // If set (e.g. "targetPort"), count DISTINCT values of that field per IP —
    // used for port-scan style rules. Null = count raw event occurrences.
    @Column(length = 32)
    private String distinctField;

    @Column(nullable = false)
    private int threshold;

    @Column(nullable = false)
    private int windowSeconds;

    // Alert severity to raise: info / warning / critical.
    @Column(nullable = false, length = 16)
    private String severity;

    @Column(nullable = false)
    private boolean enabled;

    @Column
    private Instant lastTriggeredAt;

    @Column(nullable = false)
    private long triggerCount;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getDistinctField() { return distinctField; }
    public void setDistinctField(String distinctField) { this.distinctField = distinctField; }

    public int getThreshold() { return threshold; }
    public void setThreshold(int threshold) { this.threshold = threshold; }

    public int getWindowSeconds() { return windowSeconds; }
    public void setWindowSeconds(int windowSeconds) { this.windowSeconds = windowSeconds; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public Instant getLastTriggeredAt() { return lastTriggeredAt; }
    public void setLastTriggeredAt(Instant lastTriggeredAt) { this.lastTriggeredAt = lastTriggeredAt; }

    public long getTriggerCount() { return triggerCount; }
    public void setTriggerCount(long triggerCount) { this.triggerCount = triggerCount; }
}
