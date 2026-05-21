package com.example.portdefense.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum InsightType {
    PATTERN("pattern"), ANOMALY("anomaly"), TREND("trend"), RECOMMENDATION("recommendation");

    private final String value;

    InsightType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
