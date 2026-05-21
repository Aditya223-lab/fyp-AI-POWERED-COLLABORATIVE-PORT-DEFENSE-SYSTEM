package com.example.portdefense.dto;

import com.example.portdefense.domain.Industry;
import java.util.List;

public record CreateOrgRequest(
        String name,
        Industry industry,
        Integer memberCount,
        String ownerEmail,
        List<String> ipAddresses
) {
}
