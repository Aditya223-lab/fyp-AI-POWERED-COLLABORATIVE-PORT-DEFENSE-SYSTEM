package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;


@Entity
@Table(name = "target_checks", indexes = {
        @Index(name = "ix_check_target_time", columnList = "targetId,checkedAt")
})
public class TargetCheck {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 64)
    private String targetId;

    @Column(nullable = false)
    private Instant checkedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TargetStatus status;

    @Column(nullable = false)
    private int latencyMs;

    @Column
    private Integer httpStatus;

    @Column(nullable = false)
    private int openPortCount;

    @Column(length = 256)
    private String detail;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTargetId() { return targetId; }
    public void setTargetId(String targetId) { this.targetId = targetId; }

    public Instant getCheckedAt() { return checkedAt; }
    public void setCheckedAt(Instant checkedAt) { this.checkedAt = checkedAt; }

    public TargetStatus getStatus() { return status; }
    public void setStatus(TargetStatus status) { this.status = status; }

    public int getLatencyMs() { return latencyMs; }
    public void setLatencyMs(int latencyMs) { this.latencyMs = latencyMs; }

    public Integer getHttpStatus() { return httpStatus; }
    public void setHttpStatus(Integer httpStatus) { this.httpStatus = httpStatus; }

    public int getOpenPortCount() { return openPortCount; }
    public void setOpenPortCount(int openPortCount) { this.openPortCount = openPortCount; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
}
