package com.example.portdefense.web;

import com.example.portdefense.dto.BlockRequest;
import com.example.portdefense.dto.BlockedIpDto;
import com.example.portdefense.service.FirewallResponseService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

/**
 * Active response — blocking IPs at the host firewall. Admin-only (see
 * SecurityConfig); the actions change the machine's firewall, so they are not
 * something a read-only viewer or a premium analyst can trigger.
 */
@RestController
@RequestMapping("/api/response")
public class ResponseController {

    private final FirewallResponseService service;

    public ResponseController(FirewallResponseService service) {
        this.service = service;
    }

    @GetMapping("/blocks")
    public List<BlockedIpDto> blocks() {
        return service.all();
    }

    @PostMapping("/block")
    public ResponseEntity<?> block(@RequestBody BlockRequest req, Authentication auth) {
        try {
            String by = auth == null ? null : String.valueOf(auth.getName());
            return ResponseEntity.ok(service.block(
                    req.ip(), req.reason(), req.source(), req.organizationId(), by));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/block/{id}")
    public ResponseEntity<?> unblock(@PathVariable String id) {
        try {
            return ResponseEntity.ok(service.unblock(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
