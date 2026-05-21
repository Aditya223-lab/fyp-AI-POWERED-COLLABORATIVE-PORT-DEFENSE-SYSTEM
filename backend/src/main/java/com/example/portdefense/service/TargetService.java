package com.example.portdefense.service;

import com.example.portdefense.domain.MonitorTarget;
import com.example.portdefense.dto.CreateTargetRequest;
import com.example.portdefense.dto.MonitorTargetDto;
import com.example.portdefense.repository.MonitorTargetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class TargetService {

    private final MonitorTargetRepository repo;

    public TargetService(MonitorTargetRepository repo) {
        this.repo = repo;
    }

    public List<MonitorTargetDto> all() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).toList();
    }

    @Transactional
    public MonitorTargetDto create(CreateTargetRequest req) {
        if (req == null || isBlank(req.name()) || isBlank(req.ipAddress()) || isBlank(req.ports())) {
            throw new IllegalArgumentException("name, ipAddress and ports are required");
        }
        MonitorTarget t = new MonitorTarget();
        t.setId("tgt-" + UUID.randomUUID().toString().substring(0, 8));
        t.setName(req.name().trim());
        t.setIpAddress(req.ipAddress().trim());
        t.setPorts(req.ports().trim());
        t.setOrganizationId(req.organizationId());
        t.setCreatedAt(Instant.now());
        t.setLastFindingsCount(0);
        MonitorTarget saved = repo.saveAndFlush(t);
        System.out.println("[TargetService] saved target " + saved.getId()
                + " (" + saved.getName() + ") — DB now has " + repo.count() + " targets");
        return toDto(saved);
    }

    @Transactional
    public void delete(String id) {
        repo.deleteById(id);
    }

    @Transactional
    public MonitorTargetDto markScanned(String id, int findings) {
        MonitorTarget t = repo.findById(id).orElseThrow(
                () -> new IllegalArgumentException("unknown target " + id));
        t.setLastScannedAt(Instant.now());
        t.setLastFindingsCount(findings);
        return toDto(repo.save(t));
    }

    private MonitorTargetDto toDto(MonitorTarget t) {
        return new MonitorTargetDto(
                t.getId(),
                t.getName(),
                t.getIpAddress(),
                t.getPorts(),
                t.getOrganizationId(),
                t.getCreatedAt(),
                t.getLastScannedAt(),
                t.getLastFindingsCount()
        );
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
