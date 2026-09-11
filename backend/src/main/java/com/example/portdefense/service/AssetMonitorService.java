package com.example.portdefense.service;

import com.example.portdefense.domain.AlertSeverity;
import com.example.portdefense.domain.MonitorTarget;
import com.example.portdefense.domain.TargetCheck;
import com.example.portdefense.domain.TargetStatus;
import com.example.portdefense.domain.TargetType;
import com.example.portdefense.dto.IngestLogRequest;
import com.example.portdefense.dto.Mapper;
import com.example.portdefense.dto.MonitorTargetDto;
import com.example.portdefense.dto.TargetCheckDto;
import com.example.portdefense.repository.MonitorTargetRepository;
import com.example.portdefense.repository.TargetCheckRepository;
import com.example.portdefense.web.EventsController;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * The real-time monitor. Every few seconds it probes the registered assets for
 * real — no simulation involved — and records what it saw.
 *
 * WEBSITE targets: resolve the DNS name (this is where the "live IP address of
 * a website" comes from — public DNS answers change, and we record every A
 * record we get), then issue an actual HTTP GET and time it. For https we also
 * read the server certificate and store its expiry date.
 *
 * HOST targets: resolve the name if it is one, then open real TCP connections
 * to the declared ports. A port that accepts the connection is "open"; this is
 * an availability probe, the same thing an uptime monitor does.
 *
 * Every check writes a TargetCheck history row, updates the live fields on the
 * target, raises Alerts on state changes (asset went down, came back, newly
 * exposed sensitive port, TLS expiring), feeds a log event into the SIEM, and
 * pushes the updated asset to the dashboard over SSE.
 *
 * Only probe assets you own or are authorised to test — TargetService requires
 * the caller to confirm that when registering one.
 */
@Service
public class AssetMonitorService {

    /** Ports whose exposure to the internet is worth an alert. */
    private static final java.util.Map<Integer, String> SENSITIVE_PORTS = java.util.Map.ofEntries(
            java.util.Map.entry(21, "FTP"),
            java.util.Map.entry(23, "Telnet"),
            java.util.Map.entry(135, "MSRPC"),
            java.util.Map.entry(445, "SMB"),
            java.util.Map.entry(1433, "MSSQL"),
            java.util.Map.entry(3306, "MySQL"),
            java.util.Map.entry(3389, "RDP"),
            java.util.Map.entry(5432, "PostgreSQL"),
            java.util.Map.entry(5900, "VNC"),
            java.util.Map.entry(6379, "Redis"),
            java.util.Map.entry(9200, "Elasticsearch"),
            java.util.Map.entry(27017, "MongoDB"));

    /** How many history rows to keep per asset. */
    private static final int HISTORY_KEEP = 120;

    private final MonitorTargetRepository targets;
    private final TargetCheckRepository checks;
    private final AlertService alertService;
    private final LogEventService logEventService;
    private final EventsController sse;

    private final HttpClient http;
    private final ExecutorService pool = Executors.newFixedThreadPool(6, r -> {
        Thread t = new Thread(r, "asset-monitor");
        t.setDaemon(true);
        return t;
    });

    /** Targets currently being probed, so a slow check is never started twice. */
    private final Set<String> inFlight = ConcurrentHashMap.newKeySet();
    /** Suppresses a repeat TLS-expiry alert for the same certificate. */
    private final Set<String> tlsWarned = ConcurrentHashMap.newKeySet();

    @Value("${app.monitor.enabled:true}")
    private boolean monitoringEnabled;

    @Value("${app.monitor.connect-timeout-ms:2000}")
    private int connectTimeoutMs;

    @Value("${app.monitor.http-timeout-ms:6000}")
    private int httpTimeoutMs;

    /** Above this response time an asset is UP but DEGRADED. */
    @Value("${app.monitor.slow-response-ms:2500}")
    private int slowResponseMs;

    /** Failures in a row before the "asset is down" alert fires. */
    @Value("${app.monitor.failures-before-alert:2}")
    private int failuresBeforeAlert;

    @Value("${app.monitor.max-ports:64}")
    private int maxPorts;

    @Value("${app.monitor.tls-warn-days:14}")
    private int tlsWarnDays;

    public AssetMonitorService(MonitorTargetRepository targets,
                               TargetCheckRepository checks,
                               AlertService alertService,
                               LogEventService logEventService,
                               EventsController sse) {
        this.targets = targets;
        this.checks = checks;
        this.alertService = alertService;
        this.logEventService = logEventService;
        this.sse = sse;
        this.http = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    // ------------------------------------------------------------------
    // Scheduling
    // ------------------------------------------------------------------

    /**
     * Runs often; each asset is only actually probed once its own
     * checkIntervalSeconds has elapsed, so different assets can poll at
     * different rates.
     */
    @Scheduled(fixedDelay = 5_000L, initialDelay = 8_000L)
    public void tick() {
        if (!monitoringEnabled) return;
        Instant now = Instant.now();
        for (MonitorTarget t : targets.findAll()) {
            if (!t.isEnabled()) continue;
            Instant last = t.getLastCheckedAt();
            boolean due = last == null
                    || Duration.between(last, now).getSeconds() >= t.getCheckIntervalSeconds();
            if (due) submit(t.getId());
        }
    }

    /** Probe one asset off the scheduler (used right after registration). */
    public void submit(String targetId) {
        if (!inFlight.add(targetId)) return;              // already being checked
        pool.submit(() -> {
            try {
                targets.findById(targetId).ifPresent(this::runCheck);
            } catch (RuntimeException e) {
                System.out.println("[AssetMonitor] check failed for " + targetId + ": " + e);
            } finally {
                inFlight.remove(targetId);
            }
        });
    }

    /** Probe one asset now and return the fresh state (POST /api/targets/{id}/check). */
    public MonitorTargetDto checkNow(String targetId) {
        MonitorTarget t = targets.findById(targetId).orElseThrow(
                () -> new IllegalArgumentException("unknown target " + targetId));
        return Mapper.toDto(runCheck(t));
    }

    public List<TargetCheckDto> history(String targetId, int limit) {
        int capped = Math.min(Math.max(limit, 1), HISTORY_KEEP);
        return checks.findByTargetIdOrderByCheckedAtDesc(targetId, PageRequest.of(0, capped))
                .stream().map(Mapper::toDto).toList();
    }

    // ------------------------------------------------------------------
    // One check
    // ------------------------------------------------------------------

    private MonitorTarget runCheck(MonitorTarget t) {
        TargetStatus previous = t.getStatus();
        String previousOpenPorts = t.getOpenPorts();

        Probe p = t.getType() == TargetType.WEBSITE ? probeWebsite(t) : probeHost(t);

        Instant now = Instant.now();
        t.setLastCheckedAt(now);
        t.setStatus(p.status);
        t.setLatencyMs(p.latencyMs >= 0 ? p.latencyMs : null);
        t.setHttpStatus(p.httpStatus);
        t.setLastError(p.error);
        if (!p.resolvedIps.isEmpty()) {
            t.setResolvedIps(String.join(",", p.resolvedIps));
            // Keep ipAddress pointing at something probeable: for a website (or
            // a host registered by name) that is whatever DNS says right now.
            if (t.getType() == TargetType.WEBSITE || isBlank(t.getIpAddress())
                    || t.dnsName() != null) {
                t.setIpAddress(p.resolvedIps.get(0));
            }
        }
        if (p.openPorts != null) t.setOpenPorts(p.openPorts);
        if (p.tlsExpiresAt != null) t.setTlsExpiresAt(p.tlsExpiresAt);

        boolean healthy = p.status == TargetStatus.UP || p.status == TargetStatus.DEGRADED;
        t.setChecksTotal(t.getChecksTotal() + 1);
        if (healthy) t.setChecksUp(t.getChecksUp() + 1);
        t.setConsecutiveFailures(healthy ? 0 : t.getConsecutiveFailures() + 1);

        MonitorTarget saved = targets.save(t);
        recordHistory(saved, p);
        reactToChange(saved, previous, previousOpenPorts, p);
        sse.broadcastTarget(Mapper.toDto(saved));
        return saved;
    }

    private void recordHistory(MonitorTarget t, Probe p) {
        TargetCheck c = new TargetCheck();
        c.setId("chk-" + UUID.randomUUID().toString().substring(0, 12));
        c.setTargetId(t.getId());
        c.setCheckedAt(t.getLastCheckedAt());
        c.setStatus(p.status);
        c.setLatencyMs(p.latencyMs);
        c.setHttpStatus(p.httpStatus);
        c.setOpenPortCount(p.openPortCount);
        c.setDetail(p.detail());
        checks.save(c);

        // Prune: keep only the newest HISTORY_KEEP rows for this asset.
        if (checks.countByTargetId(t.getId()) > HISTORY_KEEP + 20) {
            List<TargetCheck> keep = checks.findByTargetIdOrderByCheckedAtDesc(
                    t.getId(), PageRequest.of(0, HISTORY_KEEP));
            Instant oldest = keep.isEmpty() ? null : keep.get(keep.size() - 1).getCheckedAt();
            if (oldest != null) {
                List<TargetCheck> all = checks.findByTargetIdOrderByCheckedAtDesc(
                        t.getId(), PageRequest.of(0, 1000));
                List<TargetCheck> stale = all.stream()
                        .filter(x -> x.getCheckedAt().isBefore(oldest))
                        .toList();
                checks.deleteAll(stale);
            }
        }
    }

    /**
     * Turn a state change into the things a SOC actually wants: an alert, and a
     * log line the correlation engine can see.
     */
    private void reactToChange(MonitorTarget t, TargetStatus previous,
                               String previousOpenPorts, Probe p) {
        String label = t.getType() == TargetType.WEBSITE
                ? (t.getUrl() == null ? t.getName() : t.getUrl())
                : t.getName() + " (" + t.getIpAddress() + ")";

        boolean nowDown = p.status == TargetStatus.DOWN;
        boolean wasDown = previous == TargetStatus.DOWN;

        if (nowDown && t.getConsecutiveFailures() == failuresBeforeAlert) {
            alertService.createMonitorAlert(
                    "Asset unreachable: " + t.getName(),
                    label + " failed " + t.getConsecutiveFailures()
                            + " checks in a row. Last error: " + nz(p.error, "no response") + ".",
                    AlertSeverity.CRITICAL, t.getOrganizationId());
            log(t, "asset_down", null, nz(p.error, "unreachable"), label + " is DOWN");
        } else if (!nowDown && wasDown) {
            alertService.createMonitorAlert(
                    "Asset recovered: " + t.getName(),
                    label + " is answering again (" + p.status + ", "
                            + (p.latencyMs >= 0 ? p.latencyMs + " ms" : "no timing") + ").",
                    AlertSeverity.INFO, t.getOrganizationId());
            log(t, "asset_recovered", null, null, label + " is back UP");
        }

        // Newly exposed sensitive service on a host.
        Set<Integer> before = parsePortCsv(previousOpenPorts);
        Set<Integer> after = parsePortCsv(t.getOpenPorts());
        List<String> newlyExposed = after.stream()
                .filter(port -> !before.contains(port) && SENSITIVE_PORTS.containsKey(port))
                .sorted()
                .map(port -> SENSITIVE_PORTS.get(port) + "/" + port)
                .toList();
        if (!newlyExposed.isEmpty()) {
            alertService.createMonitorAlert(
                    "Exposed service on " + t.getName(),
                    "Port scan of " + label + " found " + String.join(", ", newlyExposed)
                            + " accepting connections. Restrict this to trusted networks "
                            + "or put it behind a firewall.",
                    AlertSeverity.WARNING, t.getOrganizationId());
            log(t, "port_exposed", after.stream().findFirst().orElse(null), null,
                    "newly reachable: " + String.join(", ", newlyExposed));
        }

        // Certificate about to expire.
        if (t.getTlsExpiresAt() != null) {
            long days = Duration.between(Instant.now(), t.getTlsExpiresAt()).toDays();
            String key = t.getId() + "@" + t.getTlsExpiresAt();
            if (days <= tlsWarnDays && tlsWarned.add(key)) {
                alertService.createMonitorAlert(
                        "TLS certificate expiring: " + t.getName(),
                        label + " has a certificate that expires in " + days + " day(s) ("
                                + t.getTlsExpiresAt() + "). Renew it before it lapses.",
                        days <= 3 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
                        t.getOrganizationId());
            }
        }
    }

    private void log(MonitorTarget t, String eventType, Integer port,
                     String statusText, String message) {
        try {
            logEventService.ingest(List.of(new IngestLogRequest(
                    Instant.now(),
                    "monitor",
                    eventType,
                    t.getIpAddress(),
                    null,
                    port,
                    t.getHttpStatus(),
                    message,
                    "[asset-monitor] " + t.getName() + " " + eventType
                            + (statusText == null ? "" : " (" + statusText + ")"),
                    t.getOrganizationId())));
        } catch (RuntimeException e) {
            // Monitoring must never fail because the SIEM write failed.
            System.out.println("[AssetMonitor] log write failed: " + e);
        }
    }

    // ------------------------------------------------------------------
    // Probes
    // ------------------------------------------------------------------

    /** Result of one real probe. */
    private static final class Probe {
        TargetStatus status = TargetStatus.UNKNOWN;
        int latencyMs = -1;
        Integer httpStatus;
        String openPorts;
        int openPortCount;
        Instant tlsExpiresAt;
        String error;
        List<String> resolvedIps = List.of();

        String detail() {
            if (error != null) return truncate(error, 250);
            if (httpStatus != null) return "HTTP " + httpStatus;
            if (openPorts != null && !openPorts.isEmpty()) return "open: " + truncate(openPorts, 200);
            return null;
        }
    }

    private Probe probeWebsite(MonitorTarget t) {
        Probe p = new Probe();
        String url = t.getUrl();
        if (isBlank(url)) {
            p.status = TargetStatus.UNKNOWN;
            p.error = "no URL configured";
            return p;
        }
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            p.status = TargetStatus.DOWN;
            p.error = "invalid URL: " + url;
            return p;
        }

        p.resolvedIps = resolve(uri.getHost());
        if (p.resolvedIps.isEmpty()) {
            p.status = TargetStatus.DOWN;
            p.error = "DNS lookup failed for " + uri.getHost();
            return p;
        }

        long started = System.nanoTime();
        try {
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofMillis(httpTimeoutMs))
                    .header("User-Agent", "PortDefense-Monitor/1.0")
                    .GET()
                    .build();
            HttpResponse<Void> res = http.send(req, HttpResponse.BodyHandlers.discarding());
            p.latencyMs = elapsedMs(started);
            p.httpStatus = res.statusCode();
            if (res.statusCode() >= 500) {
                p.status = TargetStatus.DOWN;
                p.error = "server error " + res.statusCode();
            } else if (res.statusCode() >= 400) {
                p.status = TargetStatus.DEGRADED;
                p.error = "HTTP " + res.statusCode();
            } else if (p.latencyMs > slowResponseMs) {
                p.status = TargetStatus.DEGRADED;
                p.error = "slow response (" + p.latencyMs + " ms)";
            } else {
                p.status = TargetStatus.UP;
            }
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            p.latencyMs = -1;
            p.status = TargetStatus.DOWN;
            p.error = e.getClass().getSimpleName() + ": " + truncate(nz(e.getMessage(), "no response"), 180);
        }

        if ("https".equalsIgnoreCase(uri.getScheme())) {
            p.tlsExpiresAt = readCertificateExpiry(uri.getHost(),
                    uri.getPort() > 0 ? uri.getPort() : 443);
        }
        return p;
    }

    private Probe probeHost(MonitorTarget t) {
        Probe p = new Probe();
        String dns = t.dnsName();
        String address = t.getIpAddress();
        if (dns != null) {
            p.resolvedIps = resolve(dns);
            if (p.resolvedIps.isEmpty()) {
                p.status = TargetStatus.DOWN;
                p.error = "DNS lookup failed for " + dns;
                return p;
            }
            address = p.resolvedIps.get(0);
        } else if (!isBlank(address)) {
            p.resolvedIps = List.of(address);
        }
        if (isBlank(address)) {
            p.status = TargetStatus.UNKNOWN;
            p.error = "no address configured";
            return p;
        }

        List<Integer> ports = parsePorts(t.getPorts(), maxPorts);
        List<Integer> open = new ArrayList<>();
        int bestLatency = -1;
        for (int port : ports) {
            long started = System.nanoTime();
            try (Socket s = new Socket()) {
                s.connect(new InetSocketAddress(address, port), connectTimeoutMs);
                int ms = elapsedMs(started);
                open.add(port);
                if (bestLatency < 0 || ms < bestLatency) bestLatency = ms;
            } catch (IOException ignored) {
                // Closed / filtered port — normal, not an error for the asset.
            }
        }

        p.openPorts = open.stream().map(String::valueOf).collect(Collectors.joining(","));
        p.openPortCount = open.size();
        p.latencyMs = bestLatency;

        if (!open.isEmpty()) {
            p.status = bestLatency > slowResponseMs ? TargetStatus.DEGRADED : TargetStatus.UP;
            return p;
        }

        // Nothing answered on the declared ports. The host may still be alive,
        // so fall back to an ICMP/echo-style reachability test before calling
        // it down (this is what `ping` does, minus the raw sockets).
        long started = System.nanoTime();
        try {
            if (InetAddress.getByName(address).isReachable(connectTimeoutMs)) {
                p.latencyMs = elapsedMs(started);
                p.status = TargetStatus.DEGRADED;
                p.error = ports.isEmpty()
                        ? "host reachable, no ports configured"
                        : "host reachable but no declared port is open";
                return p;
            }
        } catch (IOException e) {
            p.error = truncate(nz(e.getMessage(), "unreachable"), 180);
        }
        p.status = TargetStatus.DOWN;
        if (p.error == null) p.error = "no response on ports " + t.getPorts();
        return p;
    }

    /** Every address DNS currently returns for this name, IPv4 first. */
    private List<String> resolve(String host) {
        if (isBlank(host)) return List.of();
        try {
            return Arrays.stream(InetAddress.getAllByName(host))
                    .sorted(Comparator.comparingInt(a -> a.getAddress().length))
                    .map(InetAddress::getHostAddress)
                    .distinct()
                    .limit(8)
                    .toList();
        } catch (UnknownHostException e) {
            return List.of();
        }
    }

    /** Handshake with the site and read the expiry date off its certificate. */
    private Instant readCertificateExpiry(String host, int port) {
        SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
        try (SSLSocket socket = (SSLSocket) factory.createSocket()) {
            socket.connect(new InetSocketAddress(host, port), connectTimeoutMs);
            socket.setSoTimeout(httpTimeoutMs);
            socket.startHandshake();
            java.security.cert.Certificate[] chain = socket.getSession().getPeerCertificates();
            if (chain.length > 0 && chain[0] instanceof X509Certificate x509) {
                return x509.getNotAfter().toInstant();
            }
        } catch (IOException | RuntimeException e) {
            // A failed handshake is already reflected in the HTTP result.
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * "22,80,443" or "1-1024" or a mix — the same syntax the Python scanner
     * accepts. Capped so an asset check stays an availability probe rather
     * than turning into a wide port sweep.
     */
    public static List<Integer> parsePorts(String spec, int max) {
        Set<Integer> out = new LinkedHashSet<>();
        if (spec == null) return List.of();
        for (String part : spec.split(",")) {
            String piece = part.trim();
            if (piece.isEmpty()) continue;
            try {
                if (piece.contains("-")) {
                    String[] bounds = piece.split("-", 2);
                    int lo = Integer.parseInt(bounds[0].trim());
                    int hi = Integer.parseInt(bounds[1].trim());
                    for (int port = Math.max(1, lo); port <= Math.min(65535, hi); port++) {
                        out.add(port);
                        if (out.size() >= max) return List.copyOf(out);
                    }
                } else {
                    int port = Integer.parseInt(piece);
                    if (port >= 1 && port <= 65535) out.add(port);
                }
            } catch (NumberFormatException ignored) {
                // Skip anything that is not a port.
            }
            if (out.size() >= max) break;
        }
        return List.copyOf(out).stream().limit(max).toList();
    }

    private static Set<Integer> parsePortCsv(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try {
                        return Integer.parseInt(s);
                    } catch (NumberFormatException e) {
                        return null;
                    }
                })
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private static int elapsedMs(long startedNanos) {
        return (int) ((System.nanoTime() - startedNanos) / 1_000_000L);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String nz(String s, String fallback) {
        return s == null || s.isBlank() ? fallback : s;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
