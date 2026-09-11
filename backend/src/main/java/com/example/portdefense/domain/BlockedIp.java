package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * An IP the operator chose to block. This is the system's one *active response*
 * — everything else detects and alerts; this actually adds a rule to the host
 * firewall of the machine running the backend.
 *
 * enforcement records whether the OS firewall genuinely took the rule:
 *   ENFORCED  — netsh/iptables succeeded; traffic from this IP to this host is
 *               now dropped.
 *   SIMULATED — recorded but not applied (response disabled, unsupported OS, or
 *               the backend lacks the privileges to edit the firewall). The row
 *               still shows in the UI so the workflow is demonstrable.
 */
@Entity
@Table(name = "blocked_ips", indexes = {
        @Index(name = "ix_block_ip", columnList = "ipAddress"),
        @Index(name = "ix_block_time", columnList = "createdAt")
})
public class BlockedIp {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 64)
    private String ipAddress;

    @Column(length = 256)
    private String reason;

    /** MANUAL | ALERT | THREAT — how the block was initiated. */
    @Column(length = 16)
    private String source;

    /** ACTIVE | REMOVED */
    @Column(nullable = false, length = 16)
    private String status;

    /** ENFORCED | SIMULATED */
    @Column(nullable = false, length = 16)
    private String enforcement;

    /** The firewall rule name we created, so we can delete exactly it later. */
    @Column(length = 128)
    private String ruleName;

    @Column(length = 512)
    private String detail;

    @Column(length = 128)
    private String createdBy;

    @Column(nullable = false)
    private Instant createdAt;

    @Column
    private Instant removedAt;

    @Column(length = 64)
    private String organizationId;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getEnforcement() { return enforcement; }
    public void setEnforcement(String enforcement) { this.enforcement = enforcement; }

    public String getRuleName() { return ruleName; }
    public void setRuleName(String ruleName) { this.ruleName = ruleName; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getRemovedAt() { return removedAt; }
    public void setRemovedAt(Instant removedAt) { this.removedAt = removedAt; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }
}
