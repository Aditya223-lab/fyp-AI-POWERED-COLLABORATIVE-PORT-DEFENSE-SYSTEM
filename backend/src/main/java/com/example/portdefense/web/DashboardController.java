package com.example.portdefense.web;

import com.example.portdefense.dto.AlertDto;
import com.example.portdefense.dto.AttackPredictionDto;
import com.example.portdefense.dto.DashboardStatsDto;
import com.example.portdefense.dto.ThreatEventDto;
import com.example.portdefense.service.AlertService;
import com.example.portdefense.service.DashboardService;
import com.example.portdefense.service.PredictionService;
import com.example.portdefense.service.ThreatService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;
    private final ThreatService threatService;
    private final AlertService alertService;
    private final PredictionService predictionService;

    public DashboardController(DashboardService dashboardService,
                               ThreatService threatService,
                               AlertService alertService,
                               PredictionService predictionService) {
        this.dashboardService = dashboardService;
        this.threatService = threatService;
        this.alertService = alertService;
        this.predictionService = predictionService;
    }

    @GetMapping("/stats")
    public DashboardStatsDto stats() {
        return dashboardService.getStats();
    }

    @GetMapping("/threats/recent")
    public List<ThreatEventDto> recentThreats(@RequestParam(defaultValue = "50") int limit) {
        return threatService.getRecent(limit);
    }

    @GetMapping("/alerts")
    public List<AlertDto> alerts() {
        return alertService.getAll();
    }

    @GetMapping("/predictions")
    public List<AttackPredictionDto> predictions() {
        return predictionService.getAll();
    }
}
