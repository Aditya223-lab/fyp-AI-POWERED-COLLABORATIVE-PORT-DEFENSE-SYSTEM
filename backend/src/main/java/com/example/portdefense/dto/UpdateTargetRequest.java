package com.example.portdefense.dto;

// PATCH body for editing a monitor target. Any field left null is unchanged,
// so the UI can send only what it edited.
public record UpdateTargetRequest(
        String name,
        String address,          // URL or IP/hostname; re-parsed like on create
        String ipAddress,        // legacy alias for address
        String ports,
        Boolean enabled,
        Integer checkIntervalSeconds
) {
    public String effectiveAddress() {
        if (address != null && !address.isBlank()) return address;
        return ipAddress;
    }
}
