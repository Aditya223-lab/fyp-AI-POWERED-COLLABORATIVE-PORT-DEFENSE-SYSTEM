package com.example.portdefense.dto;

public record GenerateReportRequest(
        String title,
        String type,
        String generatedBy,
        String organizationId,
        String ownerEmail
) {
}
