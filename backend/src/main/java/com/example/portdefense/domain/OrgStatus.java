package com.example.portdefense.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum OrgStatus {
    ACTIVE("active"), WARNING("warning"), CRITICAL("critical"), OFFLINE("offline");

    private final String value;

    OrgStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
