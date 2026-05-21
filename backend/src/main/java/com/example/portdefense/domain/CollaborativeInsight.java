package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "collaborative_insights")
public class CollaborativeInsight {

    @Id
    @Column(length = 64)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private InsightType type;

    @Column(nullable = false, length = 2048)
    private String content;

    @ElementCollection(fetch = FetchType.EAGER)
    @Column(length = 128)
    private List<String> organizations = new ArrayList<>();

    @Column(nullable = false)
    private double confidence;

    @Column(nullable = false)
    private Instant timestamp;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public InsightType getType() { return type; }
    public void setType(InsightType type) { this.type = type; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public List<String> getOrganizations() { return organizations; }
    public void setOrganizations(List<String> organizations) { this.organizations = organizations; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
