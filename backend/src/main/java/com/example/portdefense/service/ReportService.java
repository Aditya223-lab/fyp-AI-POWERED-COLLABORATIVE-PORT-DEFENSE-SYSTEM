package com.example.portdefense.service;

import com.example.portdefense.domain.Report;
import com.example.portdefense.domain.Severity;
import com.example.portdefense.dto.AlertDto;
import com.example.portdefense.dto.GenerateReportRequest;
import com.example.portdefense.dto.OrganizationDto;
import com.example.portdefense.dto.ReportDto;
import com.example.portdefense.repository.ReportRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ReportService {

    private static final DateTimeFormatter HUMAN =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final ReportRepository repo;
    private final OrganizationService orgService;
    private final ThreatService threatService;
    private final AlertService alertService;
    private final ObjectMapper objectMapper;

    public ReportService(ReportRepository repo,
                         OrganizationService orgService,
                         ThreatService threatService,
                         AlertService alertService,
                         ObjectMapper objectMapper) {
        this.repo = repo;
        this.orgService = orgService;
        this.threatService = threatService;
        this.alertService = alertService;
        this.objectMapper = objectMapper;
    }

    public List<ReportDto> list() {
        return repo.findAllByOrderByGeneratedAtDesc().stream()
                .map(ReportService::toDto)
                .toList();
    }

    public List<ReportDto> listByGenerator(String generatedBy) {
        if (generatedBy == null || generatedBy.isBlank()) return list();
        return repo.findByGeneratedByIgnoreCaseOrderByGeneratedAtDesc(generatedBy.trim())
                .stream().map(ReportService::toDto).toList();
    }

    public Report getOrNull(String id) {
        return repo.findById(id).orElse(null);
    }

    @Transactional
    public boolean delete(String id) {
        if (!repo.existsById(id)) return false;
        repo.deleteById(id);
        return true;
    }

    @Transactional
    public ReportDto generate(GenerateReportRequest req) {
        Instant now = Instant.now();
        String type = (req == null || req.type() == null || req.type().isBlank())
                ? "FEDERATION_SNAPSHOT"
                : req.type().trim().toUpperCase();

        List<OrganizationDto> orgs;
        if (req != null && req.ownerEmail() != null && !req.ownerEmail().isBlank()) {
            type = "USER_PORTFOLIO";
            orgs = orgService.getByOwner(req.ownerEmail());
        } else if ("PER_ORG".equals(type) && req != null && req.organizationId() != null) {
            orgs = orgService.getAll().stream()
                    .filter(o -> o.id().equals(req.organizationId()))
                    .toList();
        } else {
            orgs = orgService.getAll();
        }

        Map<String, Map<Severity, Long>> severityByOrg = new LinkedHashMap<>();
        for (OrganizationDto o : orgs) {
            severityByOrg.put(o.id(), threatService.getSeverityByOrganization(o.id()));
        }

        List<AlertDto> alerts;
        long totalThreats;
        if ("USER_PORTFOLIO".equals(type) || "PER_ORG".equals(type)) {
            java.util.Set<String> orgIds = new java.util.HashSet<>();
            for (OrganizationDto o : orgs) orgIds.add(o.id());
            alerts = alertService.getAll().stream()
                    .filter(a -> a.organizationId() != null && orgIds.contains(a.organizationId()))
                    .toList();
            totalThreats = severityByOrg.values().stream()
                    .flatMap(m -> m.values().stream())
                    .mapToLong(Long::longValue).sum();
        } else {
            alerts = alertService.getAll();
            totalThreats = threatService.totalCount();
        }

        String title = (req == null || req.title() == null || req.title().isBlank())
                ? "Federation Snapshot · " + HUMAN.format(now)
                : req.title().trim();

        String summary = String.format(
                "%d organizations · %d threats observed · %d alerts in pipeline",
                orgs.size(), totalThreats, alerts.size());

        Report r = new Report();
        r.setId("rpt-" + UUID.randomUUID().toString().substring(0, 12));
        r.setTitle(title);
        r.setType(type);
        r.setGeneratedAt(now);
        r.setGeneratedBy(req == null ? null : req.generatedBy());
        r.setTotalThreats(totalThreats);
        r.setTotalOrgs(orgs.size());
        r.setTotalAlerts(alerts.size());
        r.setSummary(summary);
        r.setContentJson(renderJson(r, orgs, alerts, severityByOrg));
        r.setContentHtml(renderHtml(r, orgs, alerts, severityByOrg));
        Report saved = repo.saveAndFlush(r);
        System.out.println("[ReportService] saved report " + saved.getId()
                + " (" + saved.getType() + ") — DB now has " + repo.count() + " reports");
        return toDto(saved);
    }

    // --- Renderers ---

    private String renderJson(Report r,
                              List<OrganizationDto> orgs,
                              List<AlertDto> alerts,
                              Map<String, Map<Severity, Long>> severityByOrg) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", r.getId());
        payload.put("title", r.getTitle());
        payload.put("type", r.getType());
        payload.put("generatedAt", r.getGeneratedAt().toString());
        payload.put("generatedBy", r.getGeneratedBy());
        payload.put("summary", r.getSummary());
        payload.put("totals", Map.of(
                "threats", r.getTotalThreats(),
                "orgs", r.getTotalOrgs(),
                "alerts", r.getTotalAlerts()));
        payload.put("organizations", orgs);
        payload.put("severityByOrganization", severityByOrg);
        payload.put("alerts", alerts);
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(payload);
        } catch (Exception e) {
            return "{\"error\":\"failed to serialize report\"}";
        }
    }

    private String renderHtml(Report r,
                              List<OrganizationDto> orgs,
                              List<AlertDto> alerts,
                              Map<String, Map<Severity, Long>> severityByOrg) {
        StringBuilder sb = new StringBuilder(8192);
        sb.append("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">")
                .append("<title>").append(escape(r.getTitle())).append("</title>")
                .append("<style>")
                .append("body{font-family:ui-sans-serif,system-ui,sans-serif;background:#06101c;color:#e7ecf3;margin:0;padding:32px;}")
                .append("h1{font-size:28px;margin:0 0 4px;letter-spacing:-.01em;}")
                .append("h2{font-size:18px;margin:32px 0 12px;color:#67e8f9;text-transform:uppercase;letter-spacing:.08em;}")
                .append(".meta{color:#8a9cb0;font-size:13px;margin-bottom:24px;}")
                .append(".cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0 24px;}")
                .append(".card{background:#0f1c2e;border:1px solid #1c2d44;border-radius:12px;padding:16px;}")
                .append(".card .l{font-size:11px;color:#8a9cb0;text-transform:uppercase;letter-spacing:.1em;}")
                .append(".card .v{font-size:28px;font-weight:700;margin-top:4px;color:#67e8f9;}")
                .append("table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;}")
                .append("th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #1c2d44;}")
                .append("th{color:#8a9cb0;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.08em;}")
                .append("code{background:#0a1726;color:#e7ecf3;padding:2px 6px;border-radius:4px;font-size:12px;}")
                .append(".pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;}")
                .append(".sev-LOW{background:#10b98133;color:#34d399;}")
                .append(".sev-MEDIUM{background:#f59e0b33;color:#fbbf24;}")
                .append(".sev-HIGH{background:#f9731633;color:#fb923c;}")
                .append(".sev-CRITICAL{background:#ef444433;color:#fca5a5;}")
                .append("@media print{body{background:#fff;color:#000;}h2{color:#06b6d4;}.card{background:#fff;border:1px solid #ccc;}}")
                .append("</style></head><body>");

        sb.append("<h1>").append(escape(r.getTitle())).append("</h1>")
                .append("<div class=\"meta\">Type: ").append(escape(r.getType()))
                .append(" · Generated ").append(HUMAN.format(r.getGeneratedAt()));
        if (r.getGeneratedBy() != null) sb.append(" by ").append(escape(r.getGeneratedBy()));
        sb.append("</div>");

        sb.append("<div class=\"cards\">")
                .append(card("Member Orgs", String.valueOf(r.getTotalOrgs())))
                .append(card("Total Threats", String.valueOf(r.getTotalThreats())))
                .append(card("Alerts", String.valueOf(r.getTotalAlerts())))
                .append("</div>");

        sb.append("<h2>Member Organizations</h2>");
        sb.append("<table><thead><tr><th>Name</th><th>Industry</th><th>Status</th><th>Owner</th><th>IPs</th><th>Detected</th></tr></thead><tbody>");
        for (OrganizationDto o : orgs) {
            sb.append("<tr>")
                    .append("<td>").append(escape(o.name())).append("</td>")
                    .append("<td>").append(o.industry()).append("</td>")
                    .append("<td>").append(o.status()).append("</td>")
                    .append("<td>").append(o.ownerEmail() == null ? "—" : escape(o.ownerEmail())).append("</td>")
                    .append("<td><code>").append(escape(String.join(", ", o.ipAddresses()))).append("</code></td>")
                    .append("<td>").append(o.detectedAttacks()).append("</td>")
                    .append("</tr>");
        }
        sb.append("</tbody></table>");

        sb.append("<h2>Severity by Organization</h2>");
        sb.append("<table><thead><tr><th>Organization</th><th>Low</th><th>Medium</th><th>High</th><th>Critical</th></tr></thead><tbody>");
        for (OrganizationDto o : orgs) {
            Map<Severity, Long> s = severityByOrg.getOrDefault(o.id(), Map.of());
            sb.append("<tr><td>").append(escape(o.name())).append("</td>")
                    .append("<td>").append(s.getOrDefault(Severity.LOW, 0L)).append("</td>")
                    .append("<td>").append(s.getOrDefault(Severity.MEDIUM, 0L)).append("</td>")
                    .append("<td>").append(s.getOrDefault(Severity.HIGH, 0L)).append("</td>")
                    .append("<td>").append(s.getOrDefault(Severity.CRITICAL, 0L)).append("</td>")
                    .append("</tr>");
        }
        sb.append("</tbody></table>");

        sb.append("<h2>Active Alerts</h2>");
        sb.append("<table><thead><tr><th>Severity</th><th>Title</th><th>Source</th><th>Org</th><th>When</th></tr></thead><tbody>");
        for (AlertDto a : alerts) {
            sb.append("<tr>")
                    .append("<td><span class=\"pill sev-").append(a.severity()).append("\">").append(a.severity()).append("</span></td>")
                    .append("<td>").append(escape(a.title())).append("</td>")
                    .append("<td>").append(escape(a.source())).append("</td>")
                    .append("<td>").append(a.organizationId() == null ? "—" : escape(a.organizationId())).append("</td>")
                    .append("<td>").append(HUMAN.format(a.timestamp())).append("</td>")
                    .append("</tr>");
        }
        sb.append("</tbody></table>");

        sb.append("<p class=\"meta\" style=\"margin-top:32px;\">Tip: press Ctrl+P to save this report as a PDF.</p>");
        sb.append("</body></html>");
        return sb.toString();
    }

    private static String card(String label, String value) {
        return "<div class=\"card\"><div class=\"l\">" + escape(label)
                + "</div><div class=\"v\">" + escape(value) + "</div></div>";
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    static ReportDto toDto(Report r) {
        return new ReportDto(
                r.getId(),
                r.getTitle(),
                r.getType(),
                r.getGeneratedAt(),
                r.getGeneratedBy(),
                r.getTotalThreats(),
                r.getTotalOrgs(),
                r.getTotalAlerts(),
                r.getSummary()
        );
    }
}
