package com.example.portdefense.service;

import com.example.portdefense.dto.DashboardStatsDto;
import org.springframework.stereotype.Service;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class DashboardService {

    private final ThreatService threatService;
    private final OrganizationService organizationService;
    private final PredictionService predictionService;
    private final AtomicLong flRound = new AtomicLong(1284);

    public DashboardService(ThreatService threatService,
                            OrganizationService organizationService,
                            PredictionService predictionService) {
        this.threatService = threatService;
        this.organizationService = organizationService;
        this.predictionService = predictionService;
    }

    public DashboardStatsDto getStats() {
        long total = threatService.totalCount();
        long active = threatService.countActive();
        long orgs = organizationService.count();
        long predicted = predictionService.countPredictedAttacks();

        return new DashboardStatsDto(
                total,
                orgs,
                active,
                420L,
                predicted,
                94.0,
                8.0,
                87.0,
                flRound.get()
        );
    }

    public void bumpFederatedLearningRound() {
        flRound.incrementAndGet();
    }
}
