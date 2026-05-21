package com.example.portdefense.dto;

import com.example.portdefense.domain.Industry;
import com.example.portdefense.domain.OrgStatus;
import java.util.List;

// All fields optional — only the ones supplied get updated.
public record UpdateOrgRequest(
        String name,
        Industry industry,
        OrgStatus status,
        Integer memberCount,
        String ownerEmail,
        List<String> ipAddresses
) {
}
