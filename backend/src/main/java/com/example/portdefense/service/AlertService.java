package com.example.portdefense.service;

import com.example.portdefense.domain.Alert;
import com.example.portdefense.domain.AlertSeverity;
import com.example.portdefense.domain.Severity;
import com.example.portdefense.domain.Threat;
import com.example.portdefense.dto.AlertDto;
import com.example.portdefense.dto.Mapper;
import com.example.portdefense.repository.AlertRepository;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AlertService {

    private final AlertRepository repo;
    private final MailService mailService;

    // Per-source-IP cooldown so a burst of threats from one attacker does not
    // flood the alert list. Mirrors the cooldown idea in the Python detector.
    private final ConcurrentHashMap<String, Instant> lastAlertBySource = new ConcurrentHashMap<>();
    private static final Duration COOLDOWN = Duration.ofSeconds(60);

    // Same idea for the asset monitor, keyed by alert title.
    private final ConcurrentHashMap<String, Instant> lastMonitorAlertByTitle = new ConcurrentHashMap<>();
    private static final Duration MONITOR_COOLDOWN = Duration.ofMinutes(5);

    public AlertService(AlertRepository repo, MailService mailService) {
        this.repo = repo;
        this.mailService = mailService;
    }

    public List<AlertDto> getAll() {
        return repo.findAllByOrderByTimestampDesc().stream().map(Mapper::toDto).toList();
    }

    public List<AlertDto> getForOrganization(String organizationId) {
        return repo.findByOrganizationIdOrderByTimestampDesc(organizationId)
                .stream().map(Mapper::toDto).toList();
    }

    // Valid incident-response states. ACTIVE clears an acknowledgement.
    private static final java.util.Set<String> STATES =
            java.util.Set.of("ACTIVE", "ACKNOWLEDGED", "RESOLVED");

    public AlertDto updateStatus(String id, String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!STATES.contains(normalized)) {
            throw new IllegalArgumentException("status must be one of " + STATES);
        }
        Alert a = repo.findById(id).orElseThrow(
                () -> new IllegalArgumentException("unknown alert " + id));
        a.setStatus(normalized);
        // A resolved/acknowledged alert has been seen, so mark it read too.
        if (!"ACTIVE".equals(normalized)) a.setRead(true);
        return Mapper.toDto(repo.save(a));
    }

    public boolean delete(String id) {
        if (!repo.existsById(id)) return false;
        repo.deleteById(id);
        return true;
    }

    /**
     * Raise an alert from the correlation engine (rule-based detection), as
     * opposed to createFromThreat (ML-based). Cooldown is managed by the caller
     * (per rule + IP), so this just persists and notifies.
     */
    public Alert createCorrelationAlert(String title, String description,
                                        AlertSeverity severity, String sourceIP,
                                        String organizationId) {
        Alert a = new Alert();
        a.setId("alert-" + UUID.randomUUID().toString().substring(0, 8));
        a.setTitle(title);
        a.setDescription(description);
        a.setSeverity(severity == null ? AlertSeverity.WARNING : severity);
        a.setTimestamp(Instant.now());
        a.setRead(false);
        a.setSource("Correlation-Engine");
        a.setActionRequired(severity == AlertSeverity.CRITICAL);
        a.setOrganizationId(organizationId);
        a.setStatus("ACTIVE");
        Alert saved = repo.save(a);
        System.out.println("[AlertService] correlation alert " + saved.getId()
                + " raised: " + title);
        mailService.sendAlertEmail(saved);
        return saved;
    }

    /**
     * Raise an alert from the real-time asset monitor (asset down/recovered,
     * newly exposed port, TLS expiring). Identical titles inside a 5-minute
     * window are dropped so a flapping asset cannot spam the list.
     */
    public Alert createMonitorAlert(String title, String description,
                                    AlertSeverity severity, String organizationId) {
        Instant now = Instant.now();
        Instant last = lastMonitorAlertByTitle.get(title);
        if (last != null && Duration.between(last, now).compareTo(MONITOR_COOLDOWN) < 0) {
            return null;
        }
        lastMonitorAlertByTitle.put(title, now);

        Alert a = new Alert();
        a.setId("alert-" + UUID.randomUUID().toString().substring(0, 8));
        a.setTitle(title);
        a.setDescription(description);
        a.setSeverity(severity == null ? AlertSeverity.WARNING : severity);
        a.setTimestamp(now);
        a.setRead(false);
        a.setSource("Asset-Monitor");
        a.setActionRequired(severity == AlertSeverity.CRITICAL);
        a.setOrganizationId(organizationId);
        a.setStatus("ACTIVE");
        Alert saved = repo.save(a);
        System.out.println("[AlertService] monitor alert " + saved.getId() + " raised: " + title);
        mailService.sendAlertEmail(saved);
        return saved;
    }

    /**
     * Raises an Alert when an ingested threat is serious enough — either a
     * CRITICAL severity or a suspected zero-day. Returns the created Alert, or
     * null when nothing was raised (threat not severe, or the source IP is
     * still inside its 60-second cooldown).
     */
    public Alert createFromThreat(Threat t) {
        if (t == null) return null;

        boolean critical = t.getSeverity() == Severity.CRITICAL;
        boolean zeroDay = t.isZeroDay();
        if (!critical && !zeroDay) return null;          // not serious enough

        // Cooldown: at most one auto-alert per source IP per 60 seconds.
        Instant now = Instant.now();
        Instant last = lastAlertBySource.get(t.getSourceIP());
        if (last != null && Duration.between(last, now).compareTo(COOLDOWN) < 0) {
            return null;
        }
        lastAlertBySource.put(t.getSourceIP(), now);

        String attack = t.getAttackType() == null ? "threat" : t.getAttackType();
        Alert a = new Alert();
        a.setId("alert-" + UUID.randomUUID().toString().substring(0, 8));
        a.setTitle(zeroDay
                ? "Possible zero-day: " + attack + " from " + t.getSourceIP()
                : "Critical " + attack + " on port " + t.getTargetPort());
        a.setDescription(String.format(
                "AI classified a %s %s from %s targeting port %d (%s). "
                        + "Confidence %.0f%%. Review the source IP and isolate the host if needed.",
                t.getSeverity().getValue(), attack, t.getSourceIP(),
                t.getTargetPort(), t.getTargetService(), t.getConfidence() * 100));
        a.setSeverity(AlertSeverity.CRITICAL);
        a.setTimestamp(now);
        a.setRead(false);
        a.setSource("AI-Classifier");
        a.setActionRequired(true);
        a.setOrganizationId(t.getOrganizationId());
        a.setStatus("ACTIVE");

        Alert saved = repo.save(a);
        System.out.println("[AlertService] auto-raised alert " + saved.getId()
                + " for " + (zeroDay ? "zero-day" : "critical") + " threat from "
                + t.getSourceIP());
        // Fire-and-forget email notification. MailService no-ops when alerts
        // are disabled (default) and swallows SMTP errors so ingest is never
        // blocked by mail trouble.
        mailService.sendAlertEmail(saved);
        return saved;
    }
}
