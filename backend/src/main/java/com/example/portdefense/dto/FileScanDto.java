package com.example.portdefense.dto;

import java.time.Instant;

/** A malware-scan result as the dashboard shows it. */
public record FileScanDto(
        String id,
        String fileName,
        String sha256,
        long sizeBytes,
        String contentType,
        Instant submittedAt,
        String submittedBy,
        String verdict,          // CLEAN | SUSPICIOUS | MALICIOUS | UNKNOWN | ERROR
        int malicious,
        int suspicious,
        int harmless,
        int undetected,
        int engineCount,
        String threatLabel,
        String detections,       // "Kaspersky: Trojan…; ESET: …"
        String permalink,
        String errorMessage,
        boolean cached           // answered from our own table, no API call
) {
}
