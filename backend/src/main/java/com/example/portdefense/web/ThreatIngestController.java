package com.example.portdefense.web;

import com.example.portdefense.domain.GeoLocation;
import com.example.portdefense.domain.Organization;
import com.example.portdefense.domain.ScanType;
import com.example.portdefense.domain.Severity;
import com.example.portdefense.domain.Threat;
import com.example.portdefense.dto.IngestThreatRequest;
import com.example.portdefense.dto.LocationDto;
import com.example.portdefense.dto.Mapper;
import com.example.portdefense.dto.ThreatEventDto;
import com.example.portdefense.repository.OrganizationRepository;
import com.example.portdefense.repository.ThreatRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/threats")
public class ThreatIngestController {

    private final ThreatRepository threatRepository;
    private final OrganizationRepository orgRepository;
    private final EventsController sse;

    public ThreatIngestController(ThreatRepository threatRepository,
                                  OrganizationRepository orgRepository,
                                  EventsController sse) {
        this.threatRepository = threatRepository;
        this.orgRepository = orgRepository;
        this.sse = sse;
    }

    @PostMapping("/ingest")
    public ResponseEntity<ThreatEventDto> ingest(@RequestBody IngestThreatRequest req) {
        if (req == null || req.sourceIP() == null || req.targetPort() == null) {
            return ResponseEntity.badRequest().build();
        }

        Threat t = new Threat();
        t.setId("thr-" + UUID.randomUUID().toString().substring(0, 12));
        t.setSourceIP(req.sourceIP());
        t.setTargetPort(req.targetPort());
        t.setTargetService(req.targetService() == null ? guessService(req.targetPort()) : req.targetService());
        t.setTimestamp(Instant.now());
        t.setSeverity(req.severity() == null ? Severity.MEDIUM : req.severity());
        t.setScanType(req.scanType() == null ? ScanType.CONNECT : req.scanType());
        t.setAttackType(req.attackType());
        t.setAnomalyScore(req.anomalyScore() == null ? 0.5 : req.anomalyScore());

        String orgId = req.organizationId();
        Organization org = (orgId != null) ? orgRepository.findById(orgId).orElse(null) : null;
        if (org == null) {
            org = orgRepository.findAll().stream().findFirst().orElse(null);
        }
        if (org == null) {
            // No orgs exist yet — synthesise a placeholder so the event still flows.
            t.setOrganizationId("org-unknown");
            t.setOrganizationName("Unknown Org");
        } else {
            t.setOrganizationId(org.getId());
            t.setOrganizationName(org.getName());
        }

        t.setZeroDay(Boolean.TRUE.equals(req.isZeroDay()));
        t.setConfidence(req.confidence() == null ? 0.8 : req.confidence());
        t.setResponseTime(req.responseTime());

        LocationDto loc = req.location();
        if (loc != null) {
            t.setLocation(new GeoLocation(loc.lat(), loc.lng(), loc.country(), loc.city()));
        }

        threatRepository.save(t);
        ThreatEventDto dto = Mapper.toDto(t);
        sse.broadcast(dto);
        return ResponseEntity.ok(dto);
    }

    private String guessService(int port) {
        return switch (port) {
            case 22 -> "SSH";
            case 80 -> "HTTP";
            case 443 -> "HTTPS";
            case 3306 -> "MySQL";
            case 5432 -> "Postgres";
            case 6379 -> "Redis";
            case 8080, 8443 -> "HTTP-alt";
            case 27017 -> "MongoDB";
            default -> "Unknown";
        };
    }
}
