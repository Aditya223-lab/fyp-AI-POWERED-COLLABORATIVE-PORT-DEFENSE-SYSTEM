package com.example.portdefense.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * One malware-scan submission. The file itself is never stored — only its
 * SHA-256 and the verdict VirusTotal's engines returned for it, which is what
 * makes a repeat scan of the same file instant (and free, in API quota terms).
 */
@Entity
@Table(name = "file_scans", indexes = {
        @Index(name = "ix_scan_sha256", columnList = "sha256"),
        @Index(name = "ix_scan_time", columnList = "submittedAt")
})
public class FileScan {

    @Id
    @Column(length = 64)
    private String id;

    @Column(nullable = false, length = 260)
    private String fileName;

    @Column(nullable = false, length = 64)
    private String sha256;

    @Column(nullable = false)
    private long sizeBytes;

    @Column(length = 128)
    private String contentType;

    @Column(nullable = false)
    private Instant submittedAt;

    @Column(length = 128)
    private String submittedBy;

    /** CLEAN | SUSPICIOUS | MALICIOUS | UNKNOWN | ERROR */
    @Column(nullable = false, length = 16)
    private String verdict;

    /** Engine tallies from VirusTotal's last analysis. */
    @Column private int malicious;
    @Column private int suspicious;
    @Column private int harmless;
    @Column private int undetected;

    /** e.g. "Trojan.GenericKD.12345" — the most common name the engines gave. */
    @Column(length = 256)
    private String threatLabel;

    /** Engines that flagged it, "Kaspersky: Trojan…; ESET: …" */
    @Lob
    @Column
    private String detections;

    @Column(length = 512)
    private String permalink;

    @Column(length = 512)
    private String errorMessage;

    /** True when the verdict came from our own table rather than a fresh call. */
    @Column
    private Boolean cached;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }

    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }

    public String getSubmittedBy() { return submittedBy; }
    public void setSubmittedBy(String submittedBy) { this.submittedBy = submittedBy; }

    public String getVerdict() { return verdict; }
    public void setVerdict(String verdict) { this.verdict = verdict; }

    public int getMalicious() { return malicious; }
    public void setMalicious(int malicious) { this.malicious = malicious; }

    public int getSuspicious() { return suspicious; }
    public void setSuspicious(int suspicious) { this.suspicious = suspicious; }

    public int getHarmless() { return harmless; }
    public void setHarmless(int harmless) { this.harmless = harmless; }

    public int getUndetected() { return undetected; }
    public void setUndetected(int undetected) { this.undetected = undetected; }

    public String getThreatLabel() { return threatLabel; }
    public void setThreatLabel(String threatLabel) { this.threatLabel = threatLabel; }

    public String getDetections() { return detections; }
    public void setDetections(String detections) { this.detections = detections; }

    public String getPermalink() { return permalink; }
    public void setPermalink(String permalink) { this.permalink = permalink; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public boolean isCached() { return Boolean.TRUE.equals(cached); }
    public void setCached(Boolean cached) { this.cached = cached; }

    /** Engines that actually returned an opinion. */
    public int engineCount() {
        return malicious + suspicious + harmless + undetected;
    }
}
