package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A real asset the system watches: either a WEBSITE (a URL) or a HOST (a
 * computer/server, reachable by public IP or hostname).
 *
 * Two independent things happen to a target:
 *  1. AssetMonitorService (Java, in this backend) probes it for real every
 *     `checkIntervalSeconds` — DNS lookup, HTTP request or TCP connects — and
 *     records status / resolved IP / latency / uptime here.
 *  2. The Python detector may additionally scan HOST targets and report
 *     findings via /api/threats/ingest, PATCHing lastScannedAt +
 *     lastFindingsCount back here.
 *
 * Nullable wrapper types (Boolean/Integer) are deliberate: the H2 file is
 * long-lived and rows created before these columns existed read back as NULL.
 * Every getter below defaults such a NULL to something sensible.
 */
@Entity
@Table(name = "monitor_targets", indexes = {
        @Index(name = "ix_target_org", columnList = "organizationId"),
        @Index(name = "ix_target_owner", columnList = "ownerEmail")
})
public class MonitorTarget {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 128)
    private String name;

    /** WEBSITE or HOST. Null on pre-existing rows — read as HOST. */
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private TargetType type;

    /**
     * Network address actually probed. For a HOST this is what the user typed
     * (or the resolved IP when they typed a hostname); for a WEBSITE it is the
     * IP the site's DNS name currently resolves to. Kept populated so the
     * Python tools, which read this field, keep working.
     */
    @Column(nullable = false, length = 64)
    private String ipAddress;

    /** DNS name, when there is one: "example.com". Null for a bare IP. */
    @Column(length = 253)
    private String hostname;

    /** Full URL for WEBSITE targets: "https://example.com/health". */
    @Column(length = 512)
    private String url;

    /** Comma-separated list or hyphen range: "22,80,443" or "1-1024". */
    @Column(nullable = false, length = 256)
    private String ports;

    @Column(length = 64)
    private String organizationId;

    /**
     * Email of the customer who registered this asset. Null means a shared /
     * demo asset visible to everyone. Admins see all rows regardless.
     */
    @Column(length = 128)
    private String ownerEmail;

    @Column(nullable = false)
    private Instant createdAt;

    // --- live monitoring state, written by AssetMonitorService ---

    /** Pause monitoring without deleting the asset. */
    @Column
    private Boolean enabled;

    /** How often to probe, in seconds. */
    @Column
    private Integer checkIntervalSeconds;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private TargetStatus status;

    @Column
    private Instant lastCheckedAt;

    /** Every A record the hostname resolved to on the last check, comma-separated. */
    @Column(length = 512)
    private String resolvedIps;

    /** Round-trip time of the last successful probe, milliseconds. */
    @Column
    private Integer latencyMs;

    /** HTTP status code of the last check (WEBSITE targets only). */
    @Column
    private Integer httpStatus;

    /** Ports found accepting connections on the last check (HOST targets). */
    @Column(length = 256)
    private String openPorts;

    /** TLS certificate expiry for an https website. */
    @Column
    private Instant tlsExpiresAt;

    @Column(length = 256)
    private String lastError;

    /** Uptime = checksUp / checksTotal. */
    @Column
    private Long checksTotal;

    @Column
    private Long checksUp;

    @Column
    private Integer consecutiveFailures;

    // --- Python scanner state (unchanged) ---

    @Column
    private Instant lastScannedAt;

    @Column(nullable = false)
    private int lastFindingsCount;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public TargetType getType() { return TargetType.orHost(type); }
    public void setType(TargetType type) { this.type = type; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getHostname() { return hostname; }
    public void setHostname(String hostname) { this.hostname = hostname; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getPorts() { return ports; }
    public void setPorts(String ports) { this.ports = ports; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getOwnerEmail() { return ownerEmail; }
    public void setOwnerEmail(String ownerEmail) { this.ownerEmail = ownerEmail; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public boolean isEnabled() { return enabled == null || enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }

    public int getCheckIntervalSeconds() {
        return checkIntervalSeconds == null || checkIntervalSeconds <= 0 ? 30 : checkIntervalSeconds;
    }
    public void setCheckIntervalSeconds(Integer s) { this.checkIntervalSeconds = s; }

    public TargetStatus getStatus() { return TargetStatus.orUnknown(status); }
    public void setStatus(TargetStatus status) { this.status = status; }

    public Instant getLastCheckedAt() { return lastCheckedAt; }
    public void setLastCheckedAt(Instant t) { this.lastCheckedAt = t; }

    public String getResolvedIps() { return resolvedIps; }
    public void setResolvedIps(String resolvedIps) { this.resolvedIps = resolvedIps; }

    public Integer getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Integer latencyMs) { this.latencyMs = latencyMs; }

    public Integer getHttpStatus() { return httpStatus; }
    public void setHttpStatus(Integer httpStatus) { this.httpStatus = httpStatus; }

    public String getOpenPorts() { return openPorts; }
    public void setOpenPorts(String openPorts) { this.openPorts = openPorts; }

    public Instant getTlsExpiresAt() { return tlsExpiresAt; }
    public void setTlsExpiresAt(Instant tlsExpiresAt) { this.tlsExpiresAt = tlsExpiresAt; }

    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }

    public long getChecksTotal() { return checksTotal == null ? 0L : checksTotal; }
    public void setChecksTotal(Long checksTotal) { this.checksTotal = checksTotal; }

    public long getChecksUp() { return checksUp == null ? 0L : checksUp; }
    public void setChecksUp(Long checksUp) { this.checksUp = checksUp; }

    public int getConsecutiveFailures() {
        return consecutiveFailures == null ? 0 : consecutiveFailures;
    }
    public void setConsecutiveFailures(Integer n) { this.consecutiveFailures = n; }

    public Instant getLastScannedAt() { return lastScannedAt; }
    public void setLastScannedAt(Instant lastScannedAt) { this.lastScannedAt = lastScannedAt; }

    public int getLastFindingsCount() { return lastFindingsCount; }
    public void setLastFindingsCount(int lastFindingsCount) { this.lastFindingsCount = lastFindingsCount; }

    /** Uptime over the life of the asset, 0-100. */
    public double uptimePercent() {
        long total = getChecksTotal();
        return total == 0 ? 100.0 : (getChecksUp() * 100.0) / total;
    }

    /** What DNS should be asked about, or null when the address is a literal IP. */
    public String dnsName() {
        return hostname == null || hostname.isBlank() ? null : hostname;
    }
}
