package com.example.portdefense.service;

import com.example.portdefense.domain.Industry;
import com.example.portdefense.domain.Organization;
import com.example.portdefense.domain.OrgStatus;
import com.example.portdefense.dto.CollaborativeInsightDto;
import com.example.portdefense.dto.CreateOrgRequest;
import com.example.portdefense.dto.Mapper;
import com.example.portdefense.dto.OrganizationDto;
import com.example.portdefense.dto.UpdateOrgRequest;
import com.example.portdefense.repository.CollaborativeInsightRepository;
import com.example.portdefense.repository.OrganizationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class OrganizationService {

    private final OrganizationRepository orgRepo;
    private final CollaborativeInsightRepository insightRepo;

    public OrganizationService(OrganizationRepository orgRepo, CollaborativeInsightRepository insightRepo) {
        this.orgRepo = orgRepo;
        this.insightRepo = insightRepo;
    }

    public List<OrganizationDto> getAll() {
        return orgRepo.findAll().stream().map(Mapper::toDto).toList();
    }

    public List<OrganizationDto> getByOwner(String ownerEmail) {
        if (ownerEmail == null || ownerEmail.isBlank()) return List.of();
        return orgRepo.findByOwnerEmailIgnoreCase(ownerEmail.trim())
                .stream().map(Mapper::toDto).toList();
    }

    public OrganizationDto getById(String id) {
        return orgRepo.findById(id).map(Mapper::toDto).orElse(null);
    }

    public List<CollaborativeInsightDto> getInsights() {
        return insightRepo.findAllByOrderByTimestampDesc()
                .stream().map(Mapper::toDto).toList();
    }

    public long count() {
        return orgRepo.count();
    }

    @Transactional
    public OrganizationDto create(CreateOrgRequest req) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        Organization o = new Organization();
        o.setId("org-" + UUID.randomUUID().toString().substring(0, 8));
        o.setName(req.name().trim());
        o.setIndustry(req.industry() == null ? Industry.OTHER : req.industry());
        o.setStatus(OrgStatus.ACTIVE);
        o.setThreatLevel(0);
        o.setMemberCount(req.memberCount() == null ? 1 : Math.max(1, req.memberCount()));
        Instant now = Instant.now();
        o.setJoinedDate(now);
        o.setLastActive(now);
        o.setThreatScore(0);
        o.setDetectedAttacks(0L);
        o.setBlockedAttacks(0L);
        if (req.ownerEmail() != null && !req.ownerEmail().isBlank()) {
            o.setOwnerEmail(req.ownerEmail().trim().toLowerCase());
        }
        if (req.ipAddresses() != null) {
            o.setIpAddresses(req.ipAddresses());
        }
        Organization saved = orgRepo.saveAndFlush(o);
        System.out.println("[OrganizationService] saved org " + saved.getId()
                + " (" + saved.getName() + ") — DB now has " + orgRepo.count() + " orgs");
        return Mapper.toDto(saved);
    }

    @Transactional
    public OrganizationDto setOwner(String orgId, String ownerEmail) {
        Organization o = orgRepo.findById(orgId)
                .orElseThrow(() -> new IllegalArgumentException("org not found"));
        o.setOwnerEmail(ownerEmail == null || ownerEmail.isBlank()
                ? null
                : ownerEmail.trim().toLowerCase());
        return Mapper.toDto(orgRepo.save(o));
    }

    @Transactional
    public OrganizationDto setIpAddresses(String orgId, List<String> ips) {
        Organization o = orgRepo.findById(orgId)
                .orElseThrow(() -> new IllegalArgumentException("org not found"));
        o.setIpAddresses(ips);
        return Mapper.toDto(orgRepo.save(o));
    }

    @Transactional
    public OrganizationDto update(String orgId, UpdateOrgRequest req) {
        Organization o = orgRepo.findById(orgId)
                .orElseThrow(() -> new IllegalArgumentException("org not found"));
        if (req.name() != null && !req.name().isBlank()) {
            o.setName(req.name().trim());
        }
        if (req.industry() != null) {
            o.setIndustry(req.industry());
        }
        if (req.status() != null) {
            o.setStatus(req.status());
        }
        if (req.memberCount() != null) {
            o.setMemberCount(Math.max(1, req.memberCount()));
        }
        if (req.ownerEmail() != null) {
            // Empty string clears the owner; non-empty sets it.
            o.setOwnerEmail(req.ownerEmail().isBlank() ? null : req.ownerEmail().trim().toLowerCase());
        }
        if (req.ipAddresses() != null) {
            o.setIpAddresses(req.ipAddresses());
        }
        o.setLastActive(Instant.now());
        Organization saved = orgRepo.saveAndFlush(o);
        System.out.println("[OrganizationService] updated org " + saved.getId()
                + " (" + saved.getName() + ")");
        return Mapper.toDto(saved);
    }

    @Transactional
    public boolean delete(String orgId) {
        if (!orgRepo.existsById(orgId)) return false;
        orgRepo.deleteById(orgId);
        System.out.println("[OrganizationService] deleted org " + orgId
                + " — DB now has " + orgRepo.count() + " orgs");
        return true;
    }
}
