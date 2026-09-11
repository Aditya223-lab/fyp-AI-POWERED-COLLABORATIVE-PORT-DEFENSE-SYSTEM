package com.example.portdefense.web;

import com.example.portdefense.domain.Severity;
import com.example.portdefense.dto.AlertDto;
import com.example.portdefense.dto.CollaborativeInsightDto;
import com.example.portdefense.dto.CreateOrgRequest;
import com.example.portdefense.dto.OrganizationDto;
import com.example.portdefense.dto.ThreatEventDto;
import com.example.portdefense.dto.UpdateOrgRequest;
import com.example.portdefense.service.AlertService;
import com.example.portdefense.service.OrganizationService;
import com.example.portdefense.service.ThreatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/organizations")
public class OrganizationController {

    private final OrganizationService organizationService;
    private final ThreatService threatService;
    private final AlertService alertService;

    public OrganizationController(OrganizationService organizationService,
                                  ThreatService threatService,
                                  AlertService alertService) {
        this.organizationService = organizationService;
        this.threatService = threatService;
        this.alertService = alertService;
    }

    @GetMapping
    public List<OrganizationDto> all() {
        return organizationService.getAll();
    }

    @GetMapping("/by-owner/{email}")
    public List<OrganizationDto> byOwner(@PathVariable String email) {
        return organizationService.getByOwner(email);
    }

    @PostMapping
    public ResponseEntity<OrganizationDto> create(@RequestBody CreateOrgRequest req) {
        try {
            return ResponseEntity.ok(organizationService.create(req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/insights")
    public List<CollaborativeInsightDto> insights() {
        return organizationService.getInsights();
    }

    public record ProvisionDemoRequest(String ownerEmail) {}

    // Called right after a customer upgrades to Premium: gives them a personal
    // demo org (seeded with attacks) so /attacks has data to show immediately.
    // Idempotent — returns the customer's existing org if they already have one.
    @PostMapping("/provision-demo")
    public ResponseEntity<OrganizationDto> provisionDemo(@RequestBody ProvisionDemoRequest req) {
        try {
            return ResponseEntity.ok(organizationService.provisionDemoOrg(req.ownerEmail()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrganizationDto> byId(@PathVariable String id) {
        OrganizationDto dto = organizationService.getById(id);
        return dto == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(dto);
    }

    @GetMapping("/{id}/threats")
    public List<ThreatEventDto> threatsForOrg(@PathVariable String id) {
        return threatService.getByOrganization(id);
    }

    @GetMapping("/{id}/severity-stats")
    public Map<Severity, Long> severityStats(@PathVariable String id) {
        return threatService.getSeverityByOrganization(id);
    }

    @GetMapping("/{id}/alerts")
    public List<AlertDto> alertsForOrg(@PathVariable String id) {
        return alertService.getForOrganization(id);
    }

    public record UpdateOwnerRequest(String ownerEmail) {}
    public record UpdateIpsRequest(List<String> ipAddresses) {}

    @PatchMapping("/{id}/owner")
    public ResponseEntity<OrganizationDto> setOwner(
            @PathVariable String id,
            @RequestBody UpdateOwnerRequest req) {
        try {
            return ResponseEntity.ok(organizationService.setOwner(id, req.ownerEmail()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/{id}/ips")
    public ResponseEntity<OrganizationDto> setIps(
            @PathVariable String id,
            @RequestBody UpdateIpsRequest req) {
        try {
            return ResponseEntity.ok(organizationService.setIpAddresses(id, req.ipAddresses()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<OrganizationDto> update(
            @PathVariable String id,
            @RequestBody UpdateOrgRequest req) {
        try {
            return ResponseEntity.ok(organizationService.update(id, req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        return organizationService.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
