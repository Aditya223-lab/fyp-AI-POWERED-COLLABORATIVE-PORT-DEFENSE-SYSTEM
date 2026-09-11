package com.example.portdefense.web;

import com.example.portdefense.dto.CorrelationRuleDto;
import com.example.portdefense.service.CorrelationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

/**
 * Correlation rules. Listing (GET) is public so premium users can view the
 * detection rules read-only; toggling (PATCH) is gated to ROLE_ADMIN in
 * SecurityConfig.
 */
@RestController
@RequestMapping("/api/rules")
public class RuleController {

    private final CorrelationService correlationService;

    public RuleController(CorrelationService correlationService) {
        this.correlationService = correlationService;
    }

    @GetMapping
    public List<CorrelationRuleDto> all() {
        return correlationService.allRules().stream().map(CorrelationRuleDto::of).toList();
    }

    public record ToggleRequest(Boolean enabled) {}

    @PatchMapping("/{id}")
    public ResponseEntity<CorrelationRuleDto> toggle(
            @PathVariable String id,
            @RequestBody ToggleRequest body) {
        if (body.enabled() == null) return ResponseEntity.badRequest().build();
        try {
            return ResponseEntity.ok(
                    CorrelationRuleDto.of(correlationService.setEnabled(id, body.enabled())));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
