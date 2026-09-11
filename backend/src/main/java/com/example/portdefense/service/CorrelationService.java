package com.example.portdefense.service;

import com.example.portdefense.domain.AlertSeverity;
import com.example.portdefense.domain.CorrelationRule;
import com.example.portdefense.domain.LogEvent;
import com.example.portdefense.repository.CorrelationRuleRepository;
import com.example.portdefense.repository.LogEventRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * The SIEM correlation engine. On a schedule it evaluates every enabled
 * CorrelationRule against recent LogEvents, groups them by source IP, and raises
 * an Alert when a rule's threshold is crossed. This is the rule-based detection
 * that sits alongside the ML model — together they make the system a hybrid
 * SIEM / IDS.
 */
@Service
public class
CorrelationService {

    private final LogEventRepository logRepo;
    private final CorrelationRuleRepository ruleRepo;
    private final AlertService alertService;

    // Per rule+IP cooldown so an ongoing burst doesn't re-alert every cycle.
    private final Map<String, Instant> lastFired = new ConcurrentHashMap<>();

    public CorrelationService(LogEventRepository logRepo,
                              CorrelationRuleRepository ruleRepo,
                              AlertService alertService) {
        this.logRepo = logRepo;
        this.ruleRepo = ruleRepo;
        this.alertService = alertService;
    }

    /**
     * Seed / refresh the default rule set on boot. This is an UPSERT: new rules
     * are inserted, and existing ones have their definition (thresholds, event
     * type, etc.) refreshed from code while their admin enable/disable state and
     * trigger stats are preserved. That way editing a rule definition in code
     * actually takes effect on the next restart, instead of being ignored
     * because the table already had rows.
     */
    @PostConstruct
    @Transactional
    public void seedDefaults() {
        upsert(rule("rule-ssh-bruteforce", "SSH brute-force",
                "5+ failed SSH logins from one IP within 2 minutes",
                "ssh", "auth_failure", null, 5, 120, "critical"));
        upsert(rule("rule-port-scan", "Port scan",
                "One IP is blocked on 10+ distinct ports within 1 minute",
                "firewall", "connection_denied", "targetPort", 10, 60, "warning"));
        upsert(rule("rule-web-attack", "Web attack burst",
                "5+ suspicious web requests (injection/traversal/scanner) from one IP in 1 minute",
                "web", "http_attack", null, 5, 60, "critical"));
        upsert(rule("rule-firewall-sweep", "Firewall denial sweep",
                "20+ blocked connections from one IP within 1 minute",
                "firewall", "connection_denied", null, 20, 60, "warning"));
        System.out.println("[CorrelationService] seeded/refreshed default correlation rules");
    }

    private void upsert(CorrelationRule def) {
        CorrelationRule existing = ruleRepo.findById(def.getId()).orElse(null);
        if (existing == null) {
            ruleRepo.save(def);
            return;
        }
        // Refresh the definition; keep the admin's enabled flag + trigger stats.
        existing.setName(def.getName());
        existing.setDescription(def.getDescription());
        existing.setSource(def.getSource());
        existing.setEventType(def.getEventType());
        existing.setDistinctField(def.getDistinctField());
        existing.setThreshold(def.getThreshold());
        existing.setWindowSeconds(def.getWindowSeconds());
        existing.setSeverity(def.getSeverity());
        ruleRepo.save(existing);
    }

    private static CorrelationRule rule(String id, String name, String desc, String source,
                                        String eventType, String distinctField,
                                        int threshold, int windowSeconds, String severity) {
        CorrelationRule r = new CorrelationRule();
        r.setId(id);
        r.setName(name);
        r.setDescription(desc);
        r.setSource(source);
        r.setEventType(eventType);
        r.setDistinctField(distinctField);
        r.setThreshold(threshold);
        r.setWindowSeconds(windowSeconds);
        r.setSeverity(severity);
        r.setEnabled(true);
        r.setTriggerCount(0);
        return r;
    }

    /** Evaluate all enabled rules every 20 seconds. */
    @Scheduled(fixedDelay = 20_000, initialDelay = 15_000)
    @Transactional
    public void evaluate() {
        List<CorrelationRule> rules = ruleRepo.findByEnabledTrue();
        for (CorrelationRule r : rules) {
            try {
                evaluateRule(r);
            } catch (Exception e) {
                System.out.println("[CorrelationService] rule " + r.getId() + " failed: " + e.getMessage());
            }
        }
    }

    private void evaluateRule(CorrelationRule r) {
        Instant cutoff = Instant.now().minus(Duration.ofSeconds(r.getWindowSeconds()));
        List<LogEvent> events = (r.getSource() == null || r.getSource().isBlank())
                ? logRepo.findByEventTypeAndTimestampAfter(r.getEventType(), cutoff)
                : logRepo.findBySourceAndEventTypeAndTimestampAfter(
                        r.getSource(), r.getEventType(), cutoff);
        if (events.isEmpty()) return;

        // Group by source IP, then either count events or count distinct field.
        Map<String, List<LogEvent>> byIp = events.stream()
                .filter(e -> e.getSourceIP() != null)
                .collect(Collectors.groupingBy(LogEvent::getSourceIP));

        boolean fired = false;
        for (Map.Entry<String, List<LogEvent>> entry : byIp.entrySet()) {
            String ip = entry.getKey();
            int count = countFor(r, entry.getValue());
            if (count < r.getThreshold()) continue;

            // Cooldown = the rule window, so a sustained attack alerts once per window.
            String key = r.getId() + "|" + ip;
            Instant last = lastFired.get(key);
            Instant now = Instant.now();
            if (last != null && Duration.between(last, now).getSeconds() < r.getWindowSeconds()) {
                continue;
            }
            lastFired.put(key, now);

            String orgId = entry.getValue().get(0).getOrganizationId();
            alertService.createCorrelationAlert(
                    r.getName() + " from " + ip,
                    String.format("Rule '%s' matched: %d %s events from %s within %ds "
                                    + "(threshold %d). %s",
                            r.getName(), count, r.getEventType(), ip,
                            r.getWindowSeconds(), r.getThreshold(), r.getDescription()),
                    toSeverity(r.getSeverity()), ip, orgId);
            fired = true;
        }

        if (fired) {
            r.setLastTriggeredAt(Instant.now());
            r.setTriggerCount(r.getTriggerCount() + 1);
            ruleRepo.save(r);
        }
    }

    private int countFor(CorrelationRule r, List<LogEvent> events) {
        if (r.getDistinctField() == null || r.getDistinctField().isBlank()) {
            return events.size();
        }
        // Only "targetPort" is supported as a distinct field today.
        Set<Integer> distinct = new HashSet<>();
        for (LogEvent e : events) {
            if (e.getTargetPort() != null) distinct.add(e.getTargetPort());
        }
        return distinct.size();
    }

    private AlertSeverity toSeverity(String s) {
        if (s == null) return AlertSeverity.WARNING;
        return switch (s.toLowerCase()) {
            case "critical", "high" -> AlertSeverity.CRITICAL;
            case "info", "low" -> AlertSeverity.INFO;
            default -> AlertSeverity.WARNING;
        };
    }

    // Exposed for the admin rules controller (list / toggle).
    public List<CorrelationRule> allRules() {
        return ruleRepo.findAllByOrderByNameAsc();
    }

    @Transactional
    public CorrelationRule setEnabled(String id, boolean enabled) {
        CorrelationRule r = ruleRepo.findById(id).orElseThrow(
                () -> new IllegalArgumentException("unknown rule " + id));
        r.setEnabled(enabled);
        return ruleRepo.save(r);
    }
}
