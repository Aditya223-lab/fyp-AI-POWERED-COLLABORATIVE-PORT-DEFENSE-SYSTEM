package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "reports")
public class Report {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 256)
    private String title;

    // e.g. "FEDERATION_SNAPSHOT", "PER_ORG"
    @Column(nullable = false, length = 32)
    private String type;

    @Column(nullable = false)
    private Instant generatedAt;

    @Column(length = 190)
    private String generatedBy;

    @Lob
    @Column(name = "content_html", columnDefinition = "CLOB")
    private String contentHtml;

    @Lob
    @Column(name = "content_json", columnDefinition = "CLOB")
    private String contentJson;

    @Column(nullable = false)
    private long totalThreats;

    @Column(nullable = false)
    private long totalOrgs;

    @Column(nullable = false)
    private long totalAlerts;

    @Column(length = 512)
    private String summary;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Instant getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(Instant generatedAt) { this.generatedAt = generatedAt; }

    public String getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(String generatedBy) { this.generatedBy = generatedBy; }

    public String getContentHtml() { return contentHtml; }
    public void setContentHtml(String contentHtml) { this.contentHtml = contentHtml; }

    public String getContentJson() { return contentJson; }
    public void setContentJson(String contentJson) { this.contentJson = contentJson; }

    public long getTotalThreats() { return totalThreats; }
    public void setTotalThreats(long totalThreats) { this.totalThreats = totalThreats; }

    public long getTotalOrgs() { return totalOrgs; }
    public void setTotalOrgs(long totalOrgs) { this.totalOrgs = totalOrgs; }

    public long getTotalAlerts() { return totalAlerts; }
    public void setTotalAlerts(long totalAlerts) { this.totalAlerts = totalAlerts; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
}
