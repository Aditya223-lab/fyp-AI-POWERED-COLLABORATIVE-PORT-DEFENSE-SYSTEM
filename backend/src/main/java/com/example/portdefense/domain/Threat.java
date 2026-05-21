package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "threats", indexes = {
        @Index(name = "ix_threat_org", columnList = "organizationId"),
        @Index(name = "ix_threat_ts", columnList = "timestamp"),
        @Index(name = "ix_threat_severity", columnList = "severity")
})
public class Threat {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 64)
    private String sourceIP;

    @Column(nullable = false)
    private int targetPort;

    @Column(length = 64)
    private String targetService;

    @Column(nullable = false)
    private Instant timestamp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Severity severity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ScanType scanType;

    // AI-predicted attack family (PortScan, DoS, DDoS, BruteForce, ...).
    // Nullable: threats predating the model upgrade won't have it.
    @Column(length = 32)
    private String attackType;

    @Column(nullable = false)
    private double anomalyScore;

    @Column(nullable = false, length = 64)
    private String organizationId;

    @Column(nullable = false, length = 128)
    private String organizationName;

    @Embedded
    private GeoLocation location;

    @Column(nullable = false)
    private boolean isZeroDay;

    @Column(nullable = false)
    private double confidence;

    @Column
    private Integer responseTime;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSourceIP() { return sourceIP; }
    public void setSourceIP(String sourceIP) { this.sourceIP = sourceIP; }

    public int getTargetPort() { return targetPort; }
    public void setTargetPort(int targetPort) { this.targetPort = targetPort; }

    public String getTargetService() { return targetService; }
    public void setTargetService(String targetService) { this.targetService = targetService; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public Severity getSeverity() { return severity; }
    public void setSeverity(Severity severity) { this.severity = severity; }

    public ScanType getScanType() { return scanType; }
    public void setScanType(ScanType scanType) { this.scanType = scanType; }

    public String getAttackType() { return attackType; }
    public void setAttackType(String attackType) { this.attackType = attackType; }

    public double getAnomalyScore() { return anomalyScore; }
    public void setAnomalyScore(double anomalyScore) { this.anomalyScore = anomalyScore; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getOrganizationName() { return organizationName; }
    public void setOrganizationName(String organizationName) { this.organizationName = organizationName; }

    public GeoLocation getLocation() { return location; }
    public void setLocation(GeoLocation location) { this.location = location; }

    public boolean isZeroDay() { return isZeroDay; }
    public void setZeroDay(boolean zeroDay) { isZeroDay = zeroDay; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }

    public Integer getResponseTime() { return responseTime; }
    public void setResponseTime(Integer responseTime) { this.responseTime = responseTime; }
}
