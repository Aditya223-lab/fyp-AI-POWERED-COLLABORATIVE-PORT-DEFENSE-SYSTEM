package com.example.portdefense.web;

import com.example.portdefense.dto.AlertDto;
import com.example.portdefense.service.AlertService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    public List<AlertDto> all() {
        return alertService.getAll();
    }

    public record StatusRequest(String status) {}

    // Acknowledge / resolve (or re-open with ACTIVE) an alert.
    @PatchMapping("/{id}")
    public ResponseEntity<AlertDto> updateStatus(
            @PathVariable String id,
            @RequestBody StatusRequest body) {
        try {
            return ResponseEntity.ok(alertService.updateStatus(id, body.status()));
        } catch (IllegalArgumentException e) {
            return e.getMessage() != null && e.getMessage().startsWith("unknown alert")
                    ? ResponseEntity.notFound().build()
                    : ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        return alertService.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
