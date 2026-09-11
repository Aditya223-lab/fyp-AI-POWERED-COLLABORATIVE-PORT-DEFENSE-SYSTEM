package com.example.portdefense.domain;

/**
 * Result of the most recent real check against a monitored asset.
 *
 * UP       — reachable and healthy (HTTP 2xx/3xx, or at least one declared port
 *            accepting TCP connections).
 * DEGRADED — reachable but not healthy: an HTTP 4xx/5xx, a slow response, or
 *            only some of the declared ports answering.
 * DOWN     — no answer at all: DNS failure, connection refused, or timeout.
 * UNKNOWN  — never checked yet (or monitoring is paused for this asset).
 */
public enum TargetStatus {
    UP,
    DEGRADED,
    DOWN,
    UNKNOWN;

    public static TargetStatus orUnknown(TargetStatus s) {
        return s == null ? UNKNOWN : s;
    }
}
