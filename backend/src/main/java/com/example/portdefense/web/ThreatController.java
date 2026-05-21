package com.example.portdefense.web;

import com.example.portdefense.dto.HeatmapPointDto;
import com.example.portdefense.dto.ThreatEventDto;
import com.example.portdefense.dto.ThreatStatisticsDto;
import com.example.portdefense.service.ThreatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/threats")
public class ThreatController {

    private final ThreatService threatService;

    public ThreatController(ThreatService threatService) {
        this.threatService = threatService;
    }

    @GetMapping
    public List<ThreatEventDto> all() {
        return threatService.getAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ThreatEventDto> byId(@PathVariable String id) {
        ThreatEventDto dto = threatService.getById(id);
        return dto == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(dto);
    }

    @GetMapping("/statistics/{timeframe}")
    public ThreatStatisticsDto statistics(
            @PathVariable String timeframe,
            @RequestParam(value = "orgIds", required = false) String orgIds) {
        if (orgIds == null || orgIds.isBlank()) {
            return threatService.getStatistics(timeframe);
        }
        List<String> ids = Arrays.stream(orgIds.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        return threatService.getStatistics(timeframe, ids);
    }

    @GetMapping("/heatmap")
    public List<HeatmapPointDto> heatmap() {
        return threatService.getHeatmap();
    }
}
