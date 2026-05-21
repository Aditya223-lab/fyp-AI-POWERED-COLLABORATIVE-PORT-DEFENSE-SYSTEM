package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A user-registered Docker container or host the Python detector should
 * actively probe. The scanner reports findings back via /api/threats/ingest
 * and PATCHes lastScannedAt + lastFindingsCount here.
 */
@Entity
@Table(name = "monitor_targets", indexes = {
        @Index(name = "ix_target_org", columnList = "organizationId")
})
public class MonitorTarget {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(nullable = false, length = 64)
    private String ipAddress;

    /** Comma-separated list or hyphen range: "22,80,443" or "1-1024". */
    @Column(nullable = false, length = 256)
    private String ports;

    @Column(length = 64)
    private String organizationId;

    @Column(nullable = false)
    private Instant createdAt;

    @Column
    private Instant lastScannedAt;

    @Column(nullable = false)
    private int lastFindingsCount;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getPorts() { return ports; }
    public void setPorts(String ports) { this.ports = ports; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getLastScannedAt() { return lastScannedAt; }
    public void setLastScannedAt(Instant lastScannedAt) { this.lastScannedAt = lastScannedAt; }

    public int getLastFindingsCount() { return lastFindingsCount; }
    public void setLastFindingsCount(int lastFindingsCount) { this.lastFindingsCount = lastFindingsCount; }
}
