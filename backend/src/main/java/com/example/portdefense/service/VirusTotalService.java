package com.example.portdefense.service;

import com.example.portdefense.domain.AlertSeverity;
import com.example.portdefense.domain.FileScan;
import com.example.portdefense.dto.FileScanDto;
import com.example.portdefense.dto.IndicatorReportDto;
import com.example.portdefense.dto.IngestLogRequest;
import com.example.portdefense.repository.FileScanRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.Deque;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Malware and reputation lookups through the VirusTotal v3 API.
 *
 * The project's own RandomForest classifies *network flows*; it says nothing
 * about files. This service fills that gap by asking ~70 commercial AV engines
 * about a file, an IP, a domain or a URL. Two deliberate design points:
 *
 *  - A file is hashed locally (SHA-256) and looked up by hash first. Most known
 *    samples are answered without ever uploading anything, which is faster,
 *    cheaper in API quota, and avoids sending private files to a third party.
 *    An upload only happens when VirusTotal has never seen that hash.
 *  - A malicious verdict is not just displayed: it raises an Alert and writes a
 *    SIEM log event, so file detections land in the same triage queue as
 *    network detections.
 *
 * The API key is read from the server environment and never reaches the
 * browser. Without a key the service reports itself as not configured and the
 * UI explains how to set one, rather than failing at request time.
 */
@Service
public class VirusTotalService {

    private static final Pattern SHA256 = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final Pattern MD5_OR_SHA1 = Pattern.compile("^[a-fA-F0-9]{32}|[a-fA-F0-9]{40}$");
    private static final Pattern IPV4 = Pattern.compile("^\\d{1,3}(\\.\\d{1,3}){3}$");

    private final FileScanRepository repo;
    private final AlertService alertService;
    private final LogEventService logEventService;
    private final RestClient http;

    @Value("${app.virustotal.api-key:}")
    private String apiKey;

    @Value("${app.virustotal.max-file-bytes:33554432}")
    private long maxFileBytes;

    /** Public API keys allow 4 requests/minute — we hold ourselves to that. */
    @Value("${app.virustotal.requests-per-minute:4}")
    private int requestsPerMinute;

    @Value("${app.virustotal.poll-attempts:8}")
    private int pollAttempts;

    @Value("${app.virustotal.poll-interval-ms:3000}")
    private long pollIntervalMs;

    /** Timestamps of recent API calls, for the local rate limiter. */
    private final Deque<Instant> recentCalls = new ArrayDeque<>();

    public VirusTotalService(FileScanRepository repo,
                             AlertService alertService,
                             LogEventService logEventService,
                             @Value("${app.virustotal.base-url:https://www.virustotal.com/api/v3}") String baseUrl) {
        this.repo = repo;
        this.alertService = alertService;
        this.logEventService = logEventService;
        this.http = RestClient.builder().baseUrl(baseUrl).build();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public long maxFileBytes() {
        return maxFileBytes;
    }

    // ------------------------------------------------------------------
    // Files
    // ------------------------------------------------------------------

    public List<FileScanDto> history(int limit) {
        return repo.findAllByOrderBySubmittedAtDesc(PageRequest.of(0, Math.min(Math.max(limit, 1), 200)))
                .stream().map(VirusTotalService::toDto).toList();
    }

    /**
     * Scan an uploaded file. Order of operations: hash it, check our own table,
     * ask VirusTotal about the hash, and only upload when the hash is unknown.
     */
    public FileScanDto scanFile(MultipartFile file, String submittedBy, boolean forceRescan) {
        requireConfigured();
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("no file received");
        }
        if (file.getSize() > maxFileBytes) {
            throw new IllegalArgumentException("file is larger than the "
                    + (maxFileBytes / (1024 * 1024)) + " MB limit of the public API");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("could not read the uploaded file: " + e.getMessage());
        }
        String sha256 = sha256Hex(bytes);

        FileScan scan = new FileScan();
        scan.setId("scan-" + UUID.randomUUID().toString().substring(0, 12));
        scan.setFileName(trim(originalName(file), 260));
        scan.setSha256(sha256);
        scan.setSizeBytes(file.getSize());
        scan.setContentType(trim(file.getContentType(), 128));
        scan.setSubmittedAt(Instant.now());
        scan.setSubmittedBy(trim(submittedBy, 128));
        scan.setPermalink("https://www.virustotal.com/gui/file/" + sha256);

        // Same file scanned before? Reuse the verdict; no API call, no upload.
        if (!forceRescan) {
            var previous = repo.findFirstBySha256AndVerdictNotOrderBySubmittedAtDesc(sha256, "ERROR");
            if (previous.isPresent()) {
                FileScan p = previous.get();
                copyVerdict(p, scan);
                scan.setCached(true);
                return toDto(repo.save(scan));
            }
        }

        try {
            Map<?, ?> report = fetchFileReport(sha256);
            if (report == null) {
                report = uploadAndWait(bytes, scan.getFileName(), sha256);
            }
            applyReport(scan, report);
        } catch (VirusTotalException e) {
            scan.setVerdict("ERROR");
            scan.setErrorMessage(trim(e.getMessage(), 512));
        }

        FileScan saved = repo.save(scan);
        announce(saved);
        return toDto(saved);
    }

    /** GET /files/{hash} — null when VirusTotal has never seen this hash. */
    private Map<?, ?> fetchFileReport(String sha256) {
        return getJson("/files/" + sha256);
    }

    /** POST /files, then poll the analysis until the engines have finished. */
    private Map<?, ?> uploadAndWait(byte[] bytes, String fileName, String sha256) {
        rateLimit();
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        ByteArrayResource part = new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return fileName;
            }
        };
        form.add("file", part);

        Map<?, ?> submission;
        try {
            submission = http.post()
                    .uri("/files")
                    .header("x-apikey", apiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(form)
                    .retrieve()
                    .body(Map.class);
        } catch (org.springframework.web.client.RestClientResponseException e) {
            throw new VirusTotalException(describe(e.getStatusCode(), "upload"));
        } catch (RuntimeException e) {
            throw new VirusTotalException("could not reach VirusTotal: " + e.getMessage());
        }

        String analysisId = str(nested(submission, "data"), "id");
        if (analysisId == null) {
            throw new VirusTotalException("VirusTotal accepted the file but returned no analysis id");
        }

        for (int attempt = 0; attempt < pollAttempts; attempt++) {
            sleep(pollIntervalMs);
            Map<?, ?> analysis = getJson("/analyses/" + analysisId);
            String status = str(nested(analysis, "data", "attributes"), "status");
            if ("completed".equalsIgnoreCase(status)) {
                // The analysis object carries stats, but the file object also
                // has names and labels, so prefer the full report once ready.
                Map<?, ?> full = fetchFileReport(sha256);
                return full != null ? full : analysis;
            }
        }
        throw new VirusTotalException(
                "VirusTotal is still analysing this file. Its engines can take a few minutes on "
                        + "a first upload — scan it again shortly to pick up the verdict.");
    }

    // ------------------------------------------------------------------
    // Indicators (IP / domain / URL / hash)
    // ------------------------------------------------------------------

    public IndicatorReportDto lookup(String rawIndicator) {
        requireConfigured();
        String indicator = rawIndicator == null ? "" : rawIndicator.trim();
        if (indicator.isEmpty()) {
            throw new IllegalArgumentException("nothing to look up");
        }

        String kind;
        String path;
        String permalink;
        if (IPV4.matcher(indicator).matches()) {
            kind = "ip";
            path = "/ip_addresses/" + indicator;
            permalink = "https://www.virustotal.com/gui/ip-address/" + indicator;
        } else if (SHA256.matcher(indicator).matches() || MD5_OR_SHA1.matcher(indicator).matches()) {
            kind = "hash";
            path = "/files/" + indicator;
            permalink = "https://www.virustotal.com/gui/file/" + indicator;
        } else if (indicator.startsWith("http://") || indicator.startsWith("https://")) {
            kind = "url";
            // VirusTotal addresses a URL by its unpadded base64 id.
            String id = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(indicator.getBytes(StandardCharsets.UTF_8));
            path = "/urls/" + id;
            permalink = "https://www.virustotal.com/gui/url/" + id;
        } else {
            kind = "domain";
            String host = indicator.replaceFirst("^www\\.", "");
            path = "/domains/" + URLEncoder.encode(host, StandardCharsets.UTF_8);
            permalink = "https://www.virustotal.com/gui/domain/" + host;
        }

        Map<?, ?> report = getJson(path);
        if (report == null) {
            return new IndicatorReportDto(indicator, kind, "UNKNOWN", 0, 0, 0, 0,
                    "VirusTotal has no record of this indicator", null, List.of(), permalink);
        }

        Map<?, ?> attributes = nested(report, "data", "attributes");
        Map<?, ?> stats = asMap(attributes == null ? null : attributes.get("last_analysis_stats"));
        int malicious = intOf(stats, "malicious");
        int suspicious = intOf(stats, "suspicious");

        return new IndicatorReportDto(
                indicator,
                kind,
                verdictFor(malicious, suspicious),
                malicious,
                suspicious,
                intOf(stats, "harmless"),
                intOf(stats, "undetected"),
                summarize(kind, attributes),
                attributes == null ? null : intObj(attributes.get("reputation")),
                detectionList(attributes, 12),
                permalink);
    }

    private String summarize(String kind, Map<?, ?> attributes) {
        if (attributes == null) return null;
        return switch (kind) {
            case "ip" -> join(" · ", str(attributes, "country"), str(attributes, "as_owner"));
            case "domain" -> join(" · ", str(attributes, "registrar"),
                    str(attributes, "creation_date") == null ? null : "registered");
            case "hash" -> join(" · ", str(attributes, "meaningful_name"),
                    str(attributes, "type_description"));
            default -> str(attributes, "title");
        };
    }

    // ------------------------------------------------------------------
    // Turning a report into our own records
    // ------------------------------------------------------------------

    private void applyReport(FileScan scan, Map<?, ?> report) {
        Map<?, ?> attributes = nested(report, "data", "attributes");
        Map<?, ?> stats = asMap(attributes == null ? null : attributes.get("last_analysis_stats"));
        if (stats == null) stats = asMap(attributes == null ? null : attributes.get("stats"));

        scan.setMalicious(intOf(stats, "malicious"));
        scan.setSuspicious(intOf(stats, "suspicious"));
        scan.setHarmless(intOf(stats, "harmless"));
        scan.setUndetected(intOf(stats, "undetected"));
        scan.setVerdict(scan.engineCount() == 0
                ? "UNKNOWN"
                : verdictFor(scan.getMalicious(), scan.getSuspicious()));

        List<String> detections = detectionList(attributes, 20);
        if (!detections.isEmpty()) {
            scan.setDetections(String.join("; ", detections));
            // First engine result doubles as the headline threat name.
            String first = detections.get(0);
            int colon = first.indexOf(':');
            scan.setThreatLabel(trim(colon > 0 ? first.substring(colon + 1).trim() : first, 256));
        }
        if (attributes != null && scan.getFileName() == null) {
            scan.setFileName(trim(str(attributes, "meaningful_name"), 260));
        }
    }

    /** "Kaspersky: Trojan.Win32", newest engines first, capped. */
    private List<String> detectionList(Map<?, ?> attributes, int max) {
        Map<?, ?> results = asMap(attributes == null ? null : attributes.get("last_analysis_results"));
        if (results == null) return List.of();
        List<String> out = new ArrayList<>();
        for (Map.Entry<?, ?> e : results.entrySet()) {
            Map<?, ?> engine = asMap(e.getValue());
            if (engine == null) continue;
            String category = str(engine, "category");
            if (!"malicious".equals(category) && !"suspicious".equals(category)) continue;
            String result = str(engine, "result");
            out.add(e.getKey() + ": " + (result == null ? category : result));
        }
        out.sort(Comparator.naturalOrder());
        return out.size() > max ? out.subList(0, max) : out;
    }

    /** A detection is worth an alert and a SIEM entry, not just a screen. */
    private void announce(FileScan scan) {
        if (!"MALICIOUS".equals(scan.getVerdict()) && !"SUSPICIOUS".equals(scan.getVerdict())) {
            return;
        }
        boolean malicious = "MALICIOUS".equals(scan.getVerdict());
        alertService.createMonitorAlert(
                (malicious ? "Malware detected: " : "Suspicious file: ") + scan.getFileName(),
                String.format("%d of %d engines flagged %s (SHA-256 %s)%s. Submitted by %s.",
                        scan.getMalicious() + scan.getSuspicious(), scan.engineCount(),
                        scan.getFileName(), scan.getSha256(),
                        scan.getThreatLabel() == null ? "" : " as " + scan.getThreatLabel(),
                        scan.getSubmittedBy() == null ? "an analyst" : scan.getSubmittedBy()),
                malicious ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
                null);
        try {
            logEventService.ingest(List.of(new IngestLogRequest(
                    Instant.now(),
                    "malware",
                    malicious ? "malware_detected" : "file_suspicious",
                    null,
                    scan.getSubmittedBy(),
                    null,
                    null,
                    scan.getFileName() + " — " + scan.getMalicious() + "/" + scan.engineCount()
                            + " engines, " + (scan.getThreatLabel() == null ? "unnamed" : scan.getThreatLabel()),
                    "[virustotal] " + scan.getSha256(),
                    null)));
        } catch (RuntimeException e) {
            System.out.println("[VirusTotal] could not write the SIEM entry: " + e);
        }
    }

    // ------------------------------------------------------------------
    // HTTP plumbing
    // ------------------------------------------------------------------

    /** GET returning the parsed body, or null on 404 (unknown to VirusTotal). */
    private Map<?, ?> getJson(String path) {
        rateLimit();
        try {
            return http.get()
                    .uri(path)
                    .header("x-apikey", apiKey)
                    .retrieve()
                    .body(Map.class);
        } catch (org.springframework.web.client.RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) return null;
            throw new VirusTotalException(describe(e.getStatusCode(), "lookup"));
        } catch (RuntimeException e) {
            throw new VirusTotalException("could not reach VirusTotal: " + e.getMessage());
        }
    }

    private static String describe(HttpStatusCode status, String action) {
        return switch (status.value()) {
            case 401 -> "VirusTotal rejected the API key (401). Check VIRUSTOTAL_API_KEY.";
            case 403 -> "This " + action + " needs a premium VirusTotal key (403).";
            case 429 -> "VirusTotal quota exceeded (429). The free key allows 4 requests a minute "
                    + "and 500 a day — wait a moment and retry.";
            case 413 -> "VirusTotal refused the file as too large (413).";
            default -> "VirusTotal returned HTTP " + status.value() + " on " + action + ".";
        };
    }

    /** Keeps us inside the free key's 4-requests-per-minute allowance. */
    private synchronized void rateLimit() {
        Instant now = Instant.now();
        while (!recentCalls.isEmpty()
                && Duration.between(recentCalls.peekFirst(), now).getSeconds() >= 60) {
            recentCalls.pollFirst();
        }
        if (recentCalls.size() >= requestsPerMinute) {
            long waitMs = 60_000 - Duration.between(recentCalls.peekFirst(), now).toMillis();
            if (waitMs > 0) sleep(Math.min(waitMs, 60_000));
            recentCalls.pollFirst();
        }
        recentCalls.addLast(Instant.now());
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new IllegalStateException(
                    "No VirusTotal API key configured. Get a free one at virustotal.com, then start "
                            + "the backend with VIRUSTOTAL_API_KEY set.");
        }
    }

    /** Thrown for anything the API itself refused; surfaces as a readable message. */
    public static class VirusTotalException extends RuntimeException {
        public VirusTotalException(String message) {
            super(message);
        }
    }

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------

    private static String verdictFor(int malicious, int suspicious) {
        if (malicious > 0) return "MALICIOUS";
        if (suspicious > 0) return "SUSPICIOUS";
        return "CLEAN";
    }

    private static void copyVerdict(FileScan from, FileScan to) {
        to.setVerdict(from.getVerdict());
        to.setMalicious(from.getMalicious());
        to.setSuspicious(from.getSuspicious());
        to.setHarmless(from.getHarmless());
        to.setUndetected(from.getUndetected());
        to.setThreatLabel(from.getThreatLabel());
        to.setDetections(from.getDetections());
    }

    public static FileScanDto toDto(FileScan s) {
        return new FileScanDto(
                s.getId(), s.getFileName(), s.getSha256(), s.getSizeBytes(), s.getContentType(),
                s.getSubmittedAt(), s.getSubmittedBy(), s.getVerdict(), s.getMalicious(),
                s.getSuspicious(), s.getHarmless(), s.getUndetected(), s.engineCount(),
                s.getThreatLabel(), s.getDetections(), s.getPermalink(), s.getErrorMessage(),
                s.isCached());
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable in this JVM", e);
        }
    }

    private static String originalName(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name == null || name.isBlank()) return "upload";
        // Browsers may send a path on some platforms; keep only the file name.
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        return slash >= 0 ? name.substring(slash + 1) : name;
    }

    private static Map<?, ?> nested(Map<?, ?> root, String... keys) {
        Map<?, ?> current = root;
        for (String key : keys) {
            if (current == null) return null;
            current = asMap(current.get(key));
        }
        return current;
    }

    private static Map<?, ?> asMap(Object o) {
        return (o instanceof Map<?, ?> m) ? m : null;
    }

    private static String str(Map<?, ?> map, String key) {
        Object v = map == null ? null : map.get(key);
        return v == null ? null : String.valueOf(v);
    }

    private static int intOf(Map<?, ?> map, String key) {
        Integer v = intObj(map == null ? null : map.get(key));
        return v == null ? 0 : v;
    }

    private static Integer intObj(Object v) {
        if (v instanceof Number n) return n.intValue();
        return null;
    }

    private static String join(String sep, String... parts) {
        List<String> kept = new ArrayList<>();
        for (String p : parts) if (p != null && !p.isBlank()) kept.add(p);
        return kept.isEmpty() ? null : String.join(sep, kept);
    }

    private static String trim(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
