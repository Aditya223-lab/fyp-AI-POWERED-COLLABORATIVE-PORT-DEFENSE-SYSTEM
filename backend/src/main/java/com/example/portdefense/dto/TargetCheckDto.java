package com.example.portdefense.dto;

import java.time.Instant;

/** One historical probe result, used for the uptime bar / latency sparkline. */
public record TargetCheckDto(
        Instant checkedAt,
        String status,
        int latencyMs,
        Integer httpStatus,
        int openPortCount,
        String detail
) {
}
