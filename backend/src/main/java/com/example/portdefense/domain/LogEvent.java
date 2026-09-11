package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A normalized security log event collected from an external source (SSH auth
 * log, web access log, firewall, ...). This is the raw material a SIEM ingests
 * and the correlation engine runs rules over. Distinct from Threat, which is a
 * *detection* produced by the ML model.
 */
@Entity
@Table(name = "log_events", indexes = {
        @Index(name = "ix_log_ts", columnList = "timestamp"),
        @Index(name = "ix_log_src", columnList = "sourceIP"),
        @Index(name = "ix_log_type", columnList = "eventType")
})
public class LogEvent {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false)
    private Instant timestamp;

    // Which log source produced this: ssh, web, firewall, system.
    @Column(nullable = false, length = 32)
    private String source;

    // Normalized event type: auth_failure, auth_success, http_request,
    // http_attack, port_connect, connection_denied, ...
    @Column(nullable = false, length = 40)
    private String eventType;

    @Column(length = 64)
    private String sourceIP;

    // Optional structured fields (null when not applicable to the source).
    @Column(length = 64)
    private String username;

    @Column
    private Integer targetPort;

    @Column
    private Integer statusCode;

    @Column(length = 512)
    private String message;

    @Column(length = 1024)
    private String rawLine;

    @Column(length = 64)
    private String organizationId;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getSourceIP() { return sourceIP; }
    public void setSourceIP(String sourceIP) { this.sourceIP = sourceIP; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public Integer getTargetPort() { return targetPort; }
    public void setTargetPort(Integer targetPort) { this.targetPort = targetPort; }

    public Integer getStatusCode() { return statusCode; }
    public void setStatusCode(Integer statusCode) { this.statusCode = statusCode; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getRawLine() { return rawLine; }
    public void setRawLine(String rawLine) { this.rawLine = rawLine; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }
}
