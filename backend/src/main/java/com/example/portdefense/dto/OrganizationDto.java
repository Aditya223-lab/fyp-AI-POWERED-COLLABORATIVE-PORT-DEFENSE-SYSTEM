package com.example.portdefense.dto;

import com.example.portdefense.domain.Industry;
import com.example.portdefense.domain.OrgStatus;
import java.time.Instant;
import java.util.List;

public record OrganizationDto(
        String id,
        String name,
        Industry industry,
        OrgStatus status,
        int threatLevel,
        int memberCount,
        Instant joinedDate,
        Instant lastActive,
        int threatScore,
        long detectedAttacks,
        long blockedAttacks,
        String ownerEmail,
        List<String> ipAddresses
) {
}
