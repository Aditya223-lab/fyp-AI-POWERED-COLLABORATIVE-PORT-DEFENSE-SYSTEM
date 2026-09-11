package com.example.portdefense.web;

import com.example.portdefense.dto.FileScanDto;
import com.example.portdefense.dto.IndicatorReportDto;
import com.example.portdefense.service.VirusTotalService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Map;

/**
 * Malware scanning and indicator reputation, backed by VirusTotal.
 *
 * Every call goes through the backend so the API key stays on the server —
 * a browser-side key would be readable by anyone opening dev tools.
 */
@RestController
@RequestMapping("/api/vt")
public class VirusTotalController {

    private final VirusTotalService service;

    public VirusTotalController(VirusTotalService service) {
        this.service = service;
    }

    /** Lets the UI show a setup hint instead of failing on first upload. */
    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of(
                "configured", service.isConfigured(),
                "maxFileBytes", service.maxFileBytes());
    }

    @PostMapping("/scan")
    public ResponseEntity<?> scan(@RequestParam("file") MultipartFile file,
                                  @RequestParam(defaultValue = "false") boolean rescan,
                                  Authentication auth) {
        try {
            String who = auth == null ? null : String.valueOf(auth.getName());
            return ResponseEntity.ok(service.scanFile(file, who, rescan));
        } catch (IllegalArgumentException e) {
            return problem(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            return problem(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        } catch (VirusTotalService.VirusTotalException e) {
            return problem(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    /** Reputation of an IP, domain, URL or file hash. */
    @PostMapping("/lookup")
    public ResponseEntity<?> lookup(@RequestBody Map<String, String> body) {
        try {
            IndicatorReportDto report = service.lookup(body.get("indicator"));
            return ResponseEntity.ok(report);
        } catch (IllegalArgumentException e) {
            return problem(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            return problem(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        } catch (VirusTotalService.VirusTotalException e) {
            return problem(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    @GetMapping("/scans")
    public List<FileScanDto> history(@RequestParam(defaultValue = "50") int limit) {
        return service.history(limit);
    }

    private static ResponseEntity<Map<String, String>> problem(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
