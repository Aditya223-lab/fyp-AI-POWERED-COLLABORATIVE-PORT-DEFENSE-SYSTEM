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
