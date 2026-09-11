package com.example.portdefense.service;

import com.example.portdefense.domain.MonitorTarget;
import com.example.portdefense.domain.TargetStatus;
import com.example.portdefense.domain.TargetType;
import com.example.portdefense.dto.CreateTargetRequest;
import com.example.portdefense.dto.Mapper;
import com.example.portdefense.dto.MonitorTargetDto;
import com.example.portdefense.dto.UpdateTargetRequest;
import com.example.portdefense.repository.MonitorTargetRepository;
import com.example.portdefense.repository.TargetCheckRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class TargetService {

    /** Dotted-quad or bare IPv6 — anything else we treat as a DNS name. */
    private static final Pattern IPV4 =
            Pattern.compile("^\\d{1,3}(\\.\\d{1,3}){3}$");

    private final MonitorTargetRepository repo;
    private final TargetCheckRepository checks;
    private final AssetMonitorService monitor;

    public TargetService(MonitorTargetRepository repo,
                         TargetCheckRepository checks,
                         AssetMonitorService monitor) {
        this.repo = repo;
        this.checks = checks;
        this.monitor = monitor;
    }

    /** Every asset — the admin view. */
    public List<MonitorTargetDto> all() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(Mapper::toDto).toList();
    }

    /**
     * A customer's view: their own assets plus the shared demo ones. A blank
     * email falls back to the full list so the Python tools and the public
     * dashboard keep seeing everything.
     */
    public List<MonitorTargetDto> forOwner(String ownerEmail) {
        if (isBlank(ownerEmail)) return all();
        return repo.findByOwnerEmailIgnoreCaseOrOwnerEmailIsNullOrderByCreatedAtDesc(
                        ownerEmail.trim())
                .stream().map(Mapper::toDto).toList();
    }

    @Transactional
    public MonitorTargetDto create(CreateTargetRequest req) {
        if (req == null || isBlank(req.name()) || isBlank(req.effectiveAddress())) {
            throw new IllegalArgumentException("name and address are required");
        }
        if (req.authorized() != null && !req.authorized()) {
            throw new IllegalArgumentException(
                    "authorized must be true: only monitor assets you own or are permitted to probe");
        }

        MonitorTarget t = new MonitorTarget();
        t.setId("tgt-" + UUID.randomUUID().toString().substring(0, 8));
        t.setName(req.name().trim());
        applyAddress(t, TargetType.parse(req.type()), req.effectiveAddress().trim(), req.ports());
        t.setOrganizationId(req.organizationId());
        t.setOwnerEmail(isBlank(req.ownerEmail()) ? null : req.ownerEmail().trim().toLowerCase());
        t.setCreatedAt(Instant.now());
        t.setEnabled(true);
        t.setCheckIntervalSeconds(clampInterval(req.checkIntervalSeconds()));
        t.setStatus(TargetStatus.UNKNOWN);
        t.setChecksTotal(0L);
        t.setChecksUp(0L);
        t.setConsecutiveFailures(0);
        t.setLastFindingsCount(0);

        MonitorTarget saved = repo.saveAndFlush(t);
        System.out.println("[TargetService] registered " + saved.getType() + " target "
                + saved.getId() + " (" + saved.getName() + ") — DB now has "
                + repo.count() + " targets");
        // Probe it immediately so the row is not sitting at UNKNOWN while the
        // user watches; the scheduler takes over from there.
        monitor.submit(saved.getId());
        return Mapper.toDto(saved);
    }

    @Transactional
    public MonitorTargetDto update(String id, UpdateTargetRequest req) {
        MonitorTarget t = repo.findById(id).orElseThrow(
                () -> new IllegalArgumentException("unknown target " + id));
        // PATCH semantics: only overwrite fields the caller actually sent.
        if (!isBlank(req.name())) t.setName(req.name().trim());
        if (!isBlank(req.effectiveAddress())) {
            applyAddress(t, t.getType(), req.effectiveAddress().trim(), req.ports());
        } else if (!isBlank(req.ports())) {
            t.setPorts(req.ports().trim());
        }
        if (req.enabled() != null) {
            t.setEnabled(req.enabled());
            if (!req.enabled()) t.setStatus(TargetStatus.UNKNOWN);
        }
        if (req.checkIntervalSeconds() != null) {
            t.setCheckIntervalSeconds(clampInterval(req.checkIntervalSeconds()));
        }
        MonitorTarget saved = repo.save(t);
        if (saved.isEnabled()) monitor.submit(saved.getId());
        return Mapper.toDto(saved);
    }

    @Transactional
    public void delete(String id) {
        checks.deleteByTargetId(id);
        repo.deleteById(id);
    }

    @Transactional
    public MonitorTargetDto markScanned(String id, int findings) {
        MonitorTarget t = repo.findById(id).orElseThrow(
                () -> new IllegalArgumentException("unknown target " + id));
        t.setLastScannedAt(Instant.now());
        t.setLastFindingsCount(findings);
        return Mapper.toDto(repo.save(t));
    }

    /**
     * Work out what was actually registered. A URL (or anything the caller
     * marked as a WEBSITE) becomes a website target checked over HTTP; an IP or
     * hostname becomes a host target checked with TCP connects.
     */
    private void applyAddress(MonitorTarget t, TargetType requestedType,
                              String address, String ports) {
        boolean looksLikeUrl = address.startsWith("http://") || address.startsWith("https://");
        TargetType type = looksLikeUrl ? TargetType.WEBSITE : requestedType;

        if (type == TargetType.WEBSITE) {
            String url = looksLikeUrl ? address : "https://" + address;
            URI uri;
            try {
                uri = URI.create(url);
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("not a valid URL: " + address);
            }
            if (isBlank(uri.getHost())) {
                throw new IllegalArgumentException("not a valid URL: " + address);
            }
            t.setType(TargetType.WEBSITE);
            t.setUrl(url);
            t.setHostname(uri.getHost());
            // Filled in by the monitor's first DNS lookup; must be non-null.
            if (isBlank(t.getIpAddress())) t.setIpAddress("");
            t.setPorts(isBlank(ports)
                    ? ("http".equalsIgnoreCase(uri.getScheme()) ? "80" : "443")
                    : ports.trim());
            return;
        }

        t.setType(TargetType.HOST);
        t.setUrl(null);
        if (IPV4.matcher(address).matches() || address.contains(":")) {
            t.setIpAddress(address);
            t.setHostname(null);
        } else {
            // A name like "server.example.com" — the monitor resolves it and
            // writes the current IP back into ipAddress.
            t.setHostname(address);
            if (isBlank(t.getIpAddress())) t.setIpAddress("");
        }
        t.setPorts(isBlank(ports) ? "22,80,443,3306,5432,6379,8080,8443" : ports.trim());
    }

    private static int clampInterval(Integer requested) {
        if (requested == null) return 30;
        return Math.min(Math.max(requested, 10), 3600);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
