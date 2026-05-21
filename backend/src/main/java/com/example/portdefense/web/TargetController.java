package com.example.portdefense.web;

import com.example.portdefense.dto.CreateTargetRequest;
import com.example.portdefense.dto.MonitorTargetDto;
import com.example.portdefense.dto.ScanResultRequest;
import com.example.portdefense.service.TargetService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/targets")
public class TargetController {

    private final TargetService service;

    public TargetController(TargetService service) {
        this.service = service;
    }

    @GetMapping
    public List<MonitorTargetDto> all() {
        return service.all();
    }

    @PostMapping
    public ResponseEntity<MonitorTargetDto> create(@RequestBody CreateTargetRequest req) {
        try {
            return ResponseEntity.ok(service.create(req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
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
