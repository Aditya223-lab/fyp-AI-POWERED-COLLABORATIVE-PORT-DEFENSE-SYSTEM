package com.example.portdefense.domain;

/**
 * What kind of real asset a MonitorTarget points at.
 *
 * WEBSITE — a URL (https://example.com). Checked with a real HTTP request:
 *           DNS lookup, status code, response time, TLS certificate expiry.
 * HOST     — a computer/server reachable by IP or hostname. Checked with real
 *           TCP connects to the declared ports (an availability probe).
 */
public enum TargetType {
    WEBSITE,
    HOST;

    /** Older rows (added before this field existed) have no type — treat as HOST. */
    public static TargetType orHost(TargetType t) {
        return t == null ? HOST : t;
    }

    public static TargetType parse(String raw) {
        if (raw == null || raw.isBlank()) return HOST;
        return switch (raw.trim().toUpperCase()) {
            case "WEBSITE", "WEB", "URL", "SITE" -> WEBSITE;
            default -> HOST;
        };
    }
}
