package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Entity
@Table(name = "organizations")
public class Organization {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 128)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Industry industry;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrgStatus status;

    @Column(nullable = false)
    private int threatLevel;

    @Column(nullable = false)
    private int memberCount;

    @Column(nullable = false)
    private Instant joinedDate;

    @Column(nullable = false)
    private Instant lastActive;

    @Column(nullable = false)
    private int threatScore;

    @Column(nullable = false)
    private long detectedAttacks;

    @Column(nullable = false)
    private long blockedAttacks;

    // Email of the premium customer who owns this org. Nullable: admin can
    // create an org first and assign an owner later.
    @Column(length = 190)
    private String ownerEmail;

    // CSV of IPs the org wants the federation to watch. We store as CSV to
    // avoid a join table for what is effectively a small flat list.
    @Column(name = "ip_addresses", length = 2000)
    private String ipAddressesCsv;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Industry getIndustry() { return industry; }
    public void setIndustry(Industry industry) { this.industry = industry; }

    public OrgStatus getStatus() { return status; }
    public void setStatus(OrgStatus status) { this.status = status; }

    public int getThreatLevel() { return threatLevel; }
    public void setThreatLevel(int threatLevel) { this.threatLevel = threatLevel; }

    public int getMemberCount() { return memberCount; }
    public void setMemberCount(int memberCount) { this.memberCount = memberCount; }

    public Instant getJoinedDate() { return joinedDate; }
    public void setJoinedDate(Instant joinedDate) { this.joinedDate = joinedDate; }

    public Instant getLastActive() { return lastActive; }
    public void setLastActive(Instant lastActive) { this.lastActive = lastActive; }

    public int getThreatScore() { return threatScore; }
    public void setThreatScore(int threatScore) { this.threatScore = threatScore; }

    public long getDetectedAttacks() { return detectedAttacks; }
    public void setDetectedAttacks(long detectedAttacks) { this.detectedAttacks = detectedAttacks; }

    public long getBlockedAttacks() { return blockedAttacks; }
    public void setBlockedAttacks(long blockedAttacks) { this.blockedAttacks = blockedAttacks; }

    public String getOwnerEmail() { return ownerEmail; }
    public void setOwnerEmail(String ownerEmail) { this.ownerEmail = ownerEmail; }

    @Transient
    public List<String> getIpAddresses() {
        if (ipAddressesCsv == null || ipAddressesCsv.isBlank()) return new ArrayList<>();
        return Arrays.stream(ipAddressesCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public void setIpAddresses(List<String> ips) {
        if (ips == null || ips.isEmpty()) {
            this.ipAddressesCsv = null;
            return;
        }
        this.ipAddressesCsv = ips.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.joining(","));
    }
}
