package com.example.portdefense.dto;

import java.util.List;

/**
 * Reputation of a single indicator — an IP, a domain, a URL or a file hash —
 * as returned by VirusTotal. Used by the lookup box on the scan page and to
 * check the attacker IPs the detector reports.
 */
public record IndicatorReportDto(
        String indicator,
        String kind,             // ip | domain | url | hash
        String verdict,          // CLEAN | SUSPICIOUS | MALICIOUS | UNKNOWN
        int malicious,
        int suspicious,
        int harmless,
        int undetected,
        String summary,          // country / AS owner / file type, whatever fits
        Integer reputation,      // VirusTotal community score, may be null
        List<String> detections,
        String permalink
) {
}
