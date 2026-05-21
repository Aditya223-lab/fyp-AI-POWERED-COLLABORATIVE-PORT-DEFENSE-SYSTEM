package com.example.portdefense.dto;

public record CreateTargetRequest(
        String name,
        String ipAddress,
        String ports,
        String organizationId
) {
}
