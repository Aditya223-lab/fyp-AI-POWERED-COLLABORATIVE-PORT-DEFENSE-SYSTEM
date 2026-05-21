package com.example.portdefense.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum AlertSeverity {
    INFO("info"), WARNING("warning"), CRITICAL("critical");

    private final String value;

    AlertSeverity(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
