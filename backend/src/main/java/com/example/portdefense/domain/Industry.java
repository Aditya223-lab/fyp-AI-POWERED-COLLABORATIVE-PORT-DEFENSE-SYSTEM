package com.example.portdefense.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Industry {
    FINANCE("finance"), HEALTHCARE("healthcare"), EDUCATION("education"),
    TECHNOLOGY("technology"), GOVERNMENT("government"), OTHER("other");

    private final String value;

    Industry(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
