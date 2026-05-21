package com.example.portdefense.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Severity {
    LOW("low"), MEDIUM("medium"), HIGH("high"), CRITICAL("critical");

    private final String value;

    Severity(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
