package com.example.portdefense.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum ScanType {
    SYN("syn"), UDP("udp"), CONNECT("connect"), FIN("fin"),
    NULL("null"), XMAS("xmas"), ACK("ack");

    private final String value;

    ScanType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
