package com.example.portdefense.service;

import com.example.portdefense.domain.ScanType;
import com.example.portdefense.domain.Severity;
import com.example.portdefense.domain.Threat;
import com.example.portdefense.dto.HeatmapPointDto;
import com.example.portdefense.dto.Mapper;
import com.example.portdefense.dto.ThreatEventDto;
import com.example.portdefense.dto.ThreatStatisticsDto;
import com.example.portdefense.repository.ThreatRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ThreatService {

    private final ThreatRepository repository;

    public ThreatService(ThreatRepository repository) {
        this.repository = repository;
    }

    public List<ThreatEventDto> getAll() {
        return repository.findAllByOrderByTimestampDesc(PageRequest.of(0, 500))
                .stream().map(Mapper::toDto).toList();
    }

    public ThreatEventDto getById(String id) {
        return repository.findById(id).map(Mapper::toDto).orElse(null);
    }

    public List<ThreatEventDto> getRecent(int limit) {
        return repository.findAllByOrderByTimestampDesc(PageRequest.of(0, Math.max(1, limit)))
                .stream().map(Mapper::toDto).toList();
    }

    public ThreatStatisticsDto getStatistics(String timeframe) {
        return getStatistics(timeframe, null);
    }

    public ThreatStatisticsDto getStatistics(String timeframe, java.util.Collection<String> orgIds) {
        Instant cutoff = cutoffFor(timeframe);
        List<Threat> recent = repository.findByTimestampAfter(cutoff);
        if (orgIds != null && !orgIds.isEmpty()) {
            java.util.Set<String> filter = new java.util.HashSet<>(orgIds);
            recent = recent.stream()
                    .filter(t -> t.getOrganizationId() != null && filter.contains(t.getOrganizationId()))
                    .toList();
        }

        Map<Severity, Long> bySeverity = new EnumMap<>(Severity.class);
        for (Severity s : Severity.values()) bySeverity.put(s, 0L);
        Map<ScanType, Long> byType = new EnumMap<>(ScanType.class);
        for (ScanType s : ScanType.values()) byType.put(s, 0L);
        long[] byHour = new long[24];
        long zero = 0;
        double sevSum = 0;

        for (Threat t : recent) {
            bySeverity.merge(t.getSeverity(), 1L, Long::sum);
            byType.merge(t.getScanType(), 1L, Long::sum);
            int hour = t.getTimestamp().atZone(ZoneOffset.UTC).getHour();
            byHour[hour]++;
            if (t.isZeroDay()) zero++;
            sevSum += severityWeight(t.getSeverity());
        }

        List<Long> byHourList = new ArrayList<>(24);
        for (long v : byHour) byHourList.add(v);

        double avg = recent.isEmpty() ? 0 : sevSum / recent.size();
        String trend = computeTrend(recent.size());

        return new ThreatStatisticsDto(
                recent.size(), bySeverity, byType, byHourList, trend, avg, zero
        );
    }

    public List<HeatmapPointDto> getHeatmap() {
        return repository.findAllByOrderByTimestampDesc(PageRequest.of(0, 500)).stream()
                .filter(t -> t.getLocation() != null && t.getLocation().getLat() != null)
                .map(t -> new HeatmapPointDto(
                        t.getLocation().getLat(),
                        t.getLocation().getLng(),
                        severityWeight(t.getSeverity()) / 4.0))
                .collect(Collectors.toList());
    }

    public List<ThreatEventDto> getByOrganization(String organizationId) {
        return repository.findByOrganizationIdOrderByTimestampDesc(organizationId)
                .stream().map(Mapper::toDto).toList();
    }

    public Map<Severity, Long> getSeverityByOrganization(String organizationId) {
        Map<Severity, Long> out = new EnumMap<>(Severity.class);
        for (Severity s : Severity.values()) out.put(s, 0L);
        for (Threat t : repository.findByOrganizationIdOrderByTimestampDesc(organizationId)) {
            out.merge(t.getSeverity(), 1L, Long::sum);
        }
        return out;
    }

    public long countActive() {
        return repository.countRecent(Instant.now().minus(Duration.ofMinutes(15)));
    }

    public long totalCount() {
        return repository.count();
    }

    public ThreatEventDto save(Threat t) {
        return Mapper.toDto(repository.save(t));
    }

    // Valid analyst verdicts on a threat. UNREVIEWED clears a prior review.
    private static final java.util.Set<String> REVIEW_STATES =
            java.util.Set.of("UNREVIEWED", "CONFIRMED", "FALSE_POSITIVE");

    public ThreatEventDto setReview(String id, String status, String reviewedBy) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!REVIEW_STATES.contains(normalized)) {
            throw new IllegalArgumentException("status must be one of " + REVIEW_STATES);
        }
        Threat t = repository.findById(id).orElseThrow(
                () -> new IllegalArgumentException("unknown threat " + id));
        t.setReviewStatus("UNREVIEWED".equals(normalized) ? null : normalized);
        t.setReviewedBy("UNREVIEWED".equals(normalized) ? null : reviewedBy);
        return Mapper.toDto(repository.save(t));
    }

    public boolean delete(String id) {
        if (!repository.existsById(id)) return false;
        repository.deleteById(id);
        return true;
    }

    private Instant cutoffFor(String timeframe) {
        return switch (timeframe == null ? "24h" : timeframe.toLowerCase()) {
            case "1h" -> Instant.now().minus(Duration.ofHours(1));
            case "6h" -> Instant.now().minus(Duration.ofHours(6));
            case "7d" -> Instant.now().minus(Duration.ofDays(7));
            case "30d" -> Instant.now().minus(Duration.ofDays(30));
            default -> Instant.now().minus(Duration.ofHours(24));
        };
    }

    private double severityWeight(Severity s) {
        return switch (s) {
            case LOW -> 1;
            case MEDIUM -> 2;
            case HIGH -> 3;
            case CRITICAL -> 4;
        };
    }

    private String computeTrend(long count) {
        if (count == 0) return "stable";
        return count > 30 ? "increasing" : count < 10 ? "decreasing" : "stable";
    }
}
