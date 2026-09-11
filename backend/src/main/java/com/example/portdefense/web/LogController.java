package com.example.portdefense.web;

import com.example.portdefense.dto.IngestLogRequest;
import com.example.portdefense.dto.LogEventDto;
import com.example.portdefense.service.LogEventService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/logs")
public class LogController {

    private final LogEventService service;

    public LogController(LogEventService service) {
        this.service = service;
    }

    /**
     * Log shippers post a JSON array of normalized events here (batch flush of
     * many parsed lines in one request). Public — like the ML ingest — so local
     * shippers need no login.
     */
    @PostMapping("/ingest")
    public ResponseEntity<Map<String, Object>> ingest(@RequestBody List<IngestLogRequest> batch) {
        int saved = service.ingest(batch);
        return ResponseEntity.ok(Map.of("ingested", saved));
    }

    @GetMapping
    public List<LogEventDto> search(
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String sourceIP,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "200") int limit) {
        boolean noFilters = isBlank(source) && isBlank(eventType) && isBlank(sourceIP) && isBlank(q);
        return noFilters
                ? service.recent(limit)
                : service.search(source, eventType, sourceIP, q, limit);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
