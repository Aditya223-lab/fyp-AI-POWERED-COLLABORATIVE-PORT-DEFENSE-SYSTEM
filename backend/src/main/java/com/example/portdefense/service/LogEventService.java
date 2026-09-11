package com.example.portdefense.service;

import com.example.portdefense.domain.LogEvent;
import com.example.portdefense.dto.IngestLogRequest;
import com.example.portdefense.dto.LogEventDto;
import com.example.portdefense.repository.LogEventRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class LogEventService {

    private final LogEventRepository repo;

    public LogEventService(LogEventRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public int ingest(List<IngestLogRequest> batch) {
        if (batch == null || batch.isEmpty()) return 0;
        int saved = 0;
        for (IngestLogRequest r : batch) {
            if (r == null || isBlank(r.source()) || isBlank(r.eventType())) continue;
            LogEvent e = new LogEvent();
            e.setId("log-" + UUID.randomUUID().toString().substring(0, 12));
            e.setTimestamp(r.timestamp() != null ? r.timestamp() : Instant.now());
            e.setSource(r.source().trim().toLowerCase(Locale.ROOT));
            e.setEventType(r.eventType().trim().toLowerCase(Locale.ROOT));
            e.setSourceIP(r.sourceIP());
            e.setUsername(r.username());
            e.setTargetPort(r.targetPort());
            e.setStatusCode(r.statusCode());
            e.setMessage(trim(r.message(), 512));
            e.setRawLine(trim(r.rawLine(), 1024));
            e.setOrganizationId(r.organizationId());
            repo.save(e);
            saved++;
        }
        return saved;
    }

    public List<LogEventDto> recent(int limit) {
        return repo.findAllByOrderByTimestampDesc(PageRequest.of(0, clamp(limit)))
                .stream().map(this::toDto).toList();
    }

    /**
     * Analyst search. Blank filters are ignored; `q` is free text matched
     * against the source IP, message, username, event type, source and the raw
     * log line, and against the port when it is a number.
     *
     * The matching happens in the database over every stored event, so a search
     * still finds something shipped hours ago. (It used to filter a stream of
     * the newest 2000 rows, which quietly returned nothing for anything older.)
     */
    public List<LogEventDto> search(String source, String eventType, String sourceIP,
                                    String q, int limit) {
        String term = q == null ? null : q.trim().toLowerCase(Locale.ROOT);
        String like = isBlank(term) ? null : "%" + escapeLike(term) + "%";
        return repo.search(
                        lowerOrNull(source),
                        lowerOrNull(eventType),
                        isBlank(sourceIP) ? null : sourceIP.trim(),
                        like,
                        asPort(term),
                        PageRequest.of(0, clamp(limit)))
                .stream().map(this::toDto).toList();
    }

    /** "3306" should find port 3306, not just messages that mention it. */
    private static Integer asPort(String term) {
        if (isBlank(term)) return null;
        try {
            int port = Integer.parseInt(term);
            return (port >= 0 && port <= 65535) ? port : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // A literal % or _ in a search term would otherwise act as a wildcard.
    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String lowerOrNull(String s) {
        return isBlank(s) ? null : s.trim().toLowerCase(Locale.ROOT);
    }

    public long totalCount() {
        return repo.count();
    }

    public long countSince(Instant since) {
        return repo.countByTimestampAfter(since);
    }

    private LogEventDto toDto(LogEvent e) {
        return new LogEventDto(
                e.getId(), e.getTimestamp(), e.getSource(), e.getEventType(),
                e.getSourceIP(), e.getUsername(), e.getTargetPort(),
                e.getStatusCode(), e.getMessage(), e.getRawLine(), e.getOrganizationId());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trim(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static int clamp(int limit) {
        return Math.min(Math.max(limit, 1), 2000);
    }
}
