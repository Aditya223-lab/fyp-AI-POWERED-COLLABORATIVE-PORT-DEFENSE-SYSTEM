package com.example.portdefense.dto;

/**
 * Register a real asset for monitoring.
 *
 * `address` is what the user typed: a URL ("https://example.com") for a
 * WEBSITE, or an IP / hostname ("203.0.113.7", "server.example.com") for a
 * HOST. `ipAddress` is the legacy name for the same thing and is still
 * accepted so older clients keep working.
 *
 * `authorized` must be true: the caller confirms they own the asset or have
 * permission to probe it. Monitoring someone else's host without permission is
 * not something this system should help with.
 */
public record CreateTargetRequest(
        String name,
        String type,             // WEBSITE | HOST (default HOST)
        String address,          // preferred field
        String ipAddress,        // legacy alias for address
        String ports,
        String organizationId,
        String ownerEmail,
        Integer checkIntervalSeconds,
        Boolean authorized
) {
    /** Whichever address field the client sent. */
    public String effectiveAddress() {
        if (address != null && !address.isBlank()) return address;
        return ipAddress;
    }
}
