package com.example.portdefense.service;

import com.example.portdefense.domain.Alert;
import com.example.portdefense.domain.AlertSeverity;
import com.example.portdefense.domain.AttackPrediction;
import com.example.portdefense.domain.CollaborativeInsight;
import com.example.portdefense.domain.Industry;
import com.example.portdefense.domain.InsightType;
import com.example.portdefense.domain.MonitorTarget;
import com.example.portdefense.domain.OrgStatus;
import com.example.portdefense.domain.Organization;
import com.example.portdefense.domain.Role;
import com.example.portdefense.domain.TargetStatus;
import com.example.portdefense.domain.TargetType;
import com.example.portdefense.repository.AlertRepository;
import com.example.portdefense.repository.AttackPredictionRepository;
import com.example.portdefense.repository.CollaborativeInsightRepository;
import com.example.portdefense.repository.MonitorTargetRepository;
import com.example.portdefense.repository.OrganizationRepository;
import com.example.portdefense.repository.ThreatRepository;
import com.example.portdefense.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class DataSeeder implements CommandLineRunner {

    private final OrganizationRepository orgRepo;
    private final ThreatRepository threatRepo;
    private final AlertRepository alertRepo;
    private final AttackPredictionRepository predictionRepo;
    private final CollaborativeInsightRepository insightRepo;
    private final UserRepository userRepo;
    private final MonitorTargetRepository targetRepo;
    private final AuthService authService;
    private final ThreatGenerator generator;

    public DataSeeder(OrganizationRepository orgRepo,
                      ThreatRepository threatRepo,
                      AlertRepository alertRepo,
                      AttackPredictionRepository predictionRepo,
                      CollaborativeInsightRepository insightRepo,
                      UserRepository userRepo,
                      MonitorTargetRepository targetRepo,
                      AuthService authService,
                      ThreatGenerator generator) {
        this.orgRepo = orgRepo;
        this.threatRepo = threatRepo;
        this.alertRepo = alertRepo;
        this.predictionRepo = predictionRepo;
        this.insightRepo = insightRepo;
        this.userRepo = userRepo;
        this.targetRepo = targetRepo;
        this.authService = authService;
        this.generator = generator;
    }

    @Override
    public void run(String... args) {
        seedUsers();
        seedMonitoredAssets();

        if (orgRepo.count() > 0) return;

        List<Organization> orgs = seedOrganizations();
        seedThreats(orgs);
        seedAlerts();
        seedPredictions();
        seedInsights(orgs);
    }

    /**
     * Two genuinely real assets so the monitor has something to show on a fresh
     * database: this machine, and example.com (the domain IANA publishes
     * precisely so it can be used in documentation and tests). Both are left
     * unowned, which makes them visible to every signed-in account.
     */
    private void seedMonitoredAssets() {
        if (targetRepo.count() > 0) return;
        seedAsset("tgt-localhost", "This machine (localhost)", TargetType.HOST,
                "127.0.0.1", null, null, "22,80,443,3306,5432,6379,8080,8443");
        seedAsset("tgt-example", "example.com (IANA test site)", TargetType.WEBSITE,
                "", "example.com", "https://example.com", "443");
    }

    private void seedAsset(String id, String name, TargetType type, String ip,
                           String hostname, String url, String ports) {
        MonitorTarget t = new MonitorTarget();
        t.setId(id);
        t.setName(name);
        t.setType(type);
        t.setIpAddress(ip);
        t.setHostname(hostname);
        t.setUrl(url);
        t.setPorts(ports);
        t.setCreatedAt(Instant.now());
        t.setEnabled(true);
        t.setCheckIntervalSeconds(30);
        t.setStatus(TargetStatus.UNKNOWN);
        t.setChecksTotal(0L);
        t.setChecksUp(0L);
        t.setConsecutiveFailures(0);
        t.setLastFindingsCount(0);
        targetRepo.save(t);
    }

    // Default demo accounts. Change passwords before any non-local deployment.
    private void seedUsers() {
        if (userRepo.count() > 0) return;
        authService.register("admin@demo.com", "admin12345", "Demo Admin", Role.ADMIN);
        authService.register("user@demo.com", "user12345", "Demo User", Role.USER);
    }

    private List<Organization> seedOrganizations() {
        Instant now = Instant.now();
        Object[][] data = {
                {"org-0", "Alpha Bank", Industry.FINANCE, OrgStatus.ACTIVE, 65, 12, 1284L, 1180L,
                        List.of("10.20.0.10", "10.20.0.11", "10.20.0.12"), "pro@demo.com"},
                {"org-1", "Helix Health", Industry.HEALTHCARE, OrgStatus.ACTIVE, 45, 8, 842L, 805L,
                        List.of("172.16.4.5", "172.16.4.6"), null},
                {"org-2", "Northwind University", Industry.EDUCATION, OrgStatus.WARNING, 72, 4, 421L, 380L,
                        List.of("192.168.10.20", "192.168.10.21"), null},
                {"org-3", "Vertex Labs", Industry.TECHNOLOGY, OrgStatus.ACTIVE, 58, 15, 2103L, 1996L,
                        List.of("10.1.1.5", "10.1.1.6", "10.1.1.7", "10.1.1.8"), "admin@demo.com"},
                {"org-4", "Orion Telecom", Industry.OTHER, OrgStatus.CRITICAL, 88, 22, 3412L, 3105L,
                        List.of("203.0.113.42", "203.0.113.43"), null},
                {"org-5", "Solstice Energy", Industry.OTHER, OrgStatus.OFFLINE, 10, 6, 0L, 0L,
                        List.of(), null}
        };
        for (Object[] row : data) {
            Organization o = new Organization();
            o.setId((String) row[0]);
            o.setName((String) row[1]);
            o.setIndustry((Industry) row[2]);
            o.setStatus((OrgStatus) row[3]);
            o.setThreatLevel((int) row[4]);
            o.setMemberCount((int) row[5]);
            o.setJoinedDate(now.minus(Duration.ofDays(120)));
            o.setLastActive(now.minus(Duration.ofMinutes(ThreadLocalRandom.current().nextInt(60))));
            o.setThreatScore((int) row[4]);
            o.setDetectedAttacks((long) row[6]);
            o.setBlockedAttacks((long) row[7]);
            @SuppressWarnings("unchecked")
            List<String> ips = (List<String>) row[8];
            o.setIpAddresses(ips);
            o.setOwnerEmail((String) row[9]);
            orgRepo.save(o);
        }
        return orgRepo.findAll();
    }

    private void seedThreats(List<Organization> orgs) {
        for (int i = 0; i < 50; i++) {
            threatRepo.save(generator.generate(orgs, i * 3));
        }
    }

    private void seedAlerts() {
        AlertSeverity[] sevs = AlertSeverity.values();
        String[] titles = {
                "Unusual port scan pattern detected",
                "Federated round completed",
                "Zero-day signature candidate",
                "Cross-org correlation match",
                "Detection rate above target",
                "Spike in SYN scans on port 22",
                "Repeated UDP probes from 203.0.113.5",
                "FL gradient anomaly flagged"
        };
        String[] sources = {"FL-Coordinator", "Anomaly-Engine", "Edge-Sensor", "Threat-Intel"};
        // Federation-wide alerts (no org) vs. per-org alerts.
        String[] orgAssignments = {null, null, "org-0", "org-3", null, "org-4", "org-2", "org-1"};
        Instant now = Instant.now();
        for (int i = 0; i < titles.length; i++) {
            Alert a = new Alert();
            a.setId("alert-" + UUID.randomUUID().toString().substring(0, 8));
            a.setTitle(titles[i]);
            a.setDescription(titles[i] + " — review the anomaly score and source IP for context.");
            a.setSeverity(sevs[i % sevs.length]);
            a.setTimestamp(now.minus(Duration.ofMinutes(i * 7L)));
            a.setRead(false);
            a.setSource(sources[i % sources.length]);
            a.setActionRequired(i % 2 == 0);
            a.setOrganizationId(orgAssignments[i]);
            alertRepo.save(a);
        }
    }

    private void seedPredictions() {
        Instant base = Instant.now();
        for (int i = 1; i <= 6; i++) {
            AttackPrediction p = new AttackPrediction();
            p.setId("pred-" + i);
            p.setTimestamp(base.plus(Duration.ofHours(i)));
            p.setPredictedCount(5 + ThreadLocalRandom.current().nextInt(15));
            p.setConfidence(0.7 + ThreadLocalRandom.current().nextDouble() * 0.25);
            p.setLikelySources(List.of("203.0.113.5", "45.33.21.7", "78.140.10.2"));
            p.setTargetPorts(List.of(22, 443, 8080));
            p.setRecommendedActions(List.of(
                    "Rate-limit suspicious source IPs",
                    "Increase SYN flood detection sensitivity",
                    "Push updated signature to edge nodes"
            ));
            predictionRepo.save(p);
        }
    }

    private void seedInsights(List<Organization> orgs) {
        InsightType[] types = InsightType.values();
        String[] contents = {
                "Coordinated scan pattern observed across 3 finance-sector members.",
                "Anomalous burst on port 6379 (Redis) — 4 members in last hour.",
                "Decreasing trend on UDP probe attempts vs. previous week.",
                "Recommendation: rotate edge TLS certs across federation."
        };
        Instant now = Instant.now();
        for (int i = 0; i < contents.length; i++) {
            CollaborativeInsight ci = new CollaborativeInsight();
            ci.setId("ins-" + UUID.randomUUID().toString().substring(0, 8));
            ci.setType(types[i % types.length]);
            ci.setContent(contents[i]);
            ci.setOrganizations(List.of(
                    orgs.get(i % orgs.size()).getName(),
                    orgs.get((i + 1) % orgs.size()).getName()
            ));
            ci.setConfidence(0.7 + ThreadLocalRandom.current().nextDouble() * 0.25);
            ci.setTimestamp(now.minus(Duration.ofMinutes(i * 11L)));
            insightRepo.save(ci);
        }
    }
}
