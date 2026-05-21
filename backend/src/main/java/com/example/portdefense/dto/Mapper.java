package com.example.portdefense.dto;

import com.example.portdefense.domain.Alert;
import com.example.portdefense.domain.AttackPrediction;
import com.example.portdefense.domain.CollaborativeInsight;
import com.example.portdefense.domain.GeoLocation;
import com.example.portdefense.domain.Organization;
import com.example.portdefense.domain.Threat;

public final class Mapper {

    private Mapper() {
    }

    public static LocationDto toDto(GeoLocation g) {
        if (g == null) return null;
        return new LocationDto(g.getLat(), g.getLng(), g.getCountry(), g.getCity());
    }

    public static ThreatEventDto toDto(Threat t) {
        return new ThreatEventDto(
                t.getId(),
                t.getSourceIP(),
                t.getTargetPort(),
                t.getTargetService(),
                t.getTimestamp(),
                t.getSeverity(),
                t.getScanType(),
                t.getAttackType(),
                t.getAnomalyScore(),
                t.getOrganizationId(),
                t.getOrganizationName(),
                toDto(t.getLocation()),
                t.isZeroDay(),
                t.getConfidence(),
                t.getResponseTime()
        );
    }

    public static OrganizationDto toDto(Organization o) {
        return new OrganizationDto(
                o.getId(),
                o.getName(),
                o.getIndustry(),
                o.getStatus(),
                o.getThreatLevel(),
                o.getMemberCount(),
                o.getJoinedDate(),
                o.getLastActive(),
                o.getThreatScore(),
                o.getDetectedAttacks(),
                o.getBlockedAttacks(),
                o.getOwnerEmail(),
                o.getIpAddresses()
        );
    }

    public static AlertDto toDto(Alert a) {
        return new AlertDto(
                a.getId(),
                a.getTitle(),
                a.getDescription(),
                a.getSeverity(),
                a.getTimestamp(),
                a.isRead(),
                a.getSource(),
                a.isActionRequired(),
                a.getOrganizationId()
        );
    }

    public static AttackPredictionDto toDto(AttackPrediction p) {
        return new AttackPredictionDto(
                p.getTimestamp(),
                p.getPredictedCount(),
                p.getConfidence(),
                p.getLikelySources(),
                p.getTargetPorts(),
                p.getRecommendedActions()
        );
    }

    public static CollaborativeInsightDto toDto(CollaborativeInsight i) {
        return new CollaborativeInsightDto(
                i.getId(),
                i.getType(),
                i.getContent(),
                i.getOrganizations(),
                i.getConfidence(),
                i.getTimestamp()
        );
    }
}
