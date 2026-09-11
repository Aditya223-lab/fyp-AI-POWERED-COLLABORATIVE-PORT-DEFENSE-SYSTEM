package com.example.portdefense.web;

import com.example.portdefense.dto.CreateTargetRequest;
import com.example.portdefense.dto.MonitorTargetDto;
import com.example.portdefense.dto.ScanResultRequest;
import com.example.portdefense.dto.TargetCheckDto;
import com.example.portdefense.dto.UpdateTargetRequest;
import com.example.portdefense.service.AssetMonitorService;
import com.example.portdefense.service.TargetService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/targets")
public class TargetController {

    private final TargetService service;
    private final AssetMonitorService monitor;

    public TargetController(TargetService service, AssetMonitorService monitor) {
        this.service = service;
        this.monitor = monitor;
    }

    /**
     * All assets, or — with ?ownerEmail= — the ones that customer owns plus the
     * shared demo assets. The admin console calls it without the parameter; the
     * premium Monitor page passes the signed-in user's email.
     */
    @GetMapping
    public List<MonitorTargetDto> all(
            @RequestParam(required = false) String ownerEmail) {
        return service.forOwner(ownerEmail);
    }

    @PostMapping
    public ResponseEntity<MonitorTargetDto> create(@RequestBody CreateTargetRequest req) {
        try {
            return ResponseEntity.ok(service.create(req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<MonitorTargetDto> update(
            @PathVariable String id,
            @RequestBody UpdateTargetRequest req) {
        try {
            return ResponseEntity.ok(service.update(id, req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Probe this asset right now instead of waiting for its next interval. */
    @PostMapping("/{id}/check")
    public ResponseEntity<MonitorTargetDto> checkNow(@PathVariable String id) {
        try {
            return ResponseEntity.ok(monitor.checkNow(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** Recent check results, newest first — the uptime bar and latency trend. */
    @GetMapping("/{id}/history")
    public List<TargetCheckDto> history(
            @PathVariable String id,
            @RequestParam(defaultValue = "60") int limit) {
        return monitor.history(id, limit);
    }

    @PatchMapping("/{id}/scanned")
    public ResponseEntity<MonitorTargetDto> markScanned(
            @PathVariable String id,
            @RequestBody ScanResultRequest body) {
        try {
            return ResponseEntity.ok(service.markScanned(id, body.findingsCount()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
