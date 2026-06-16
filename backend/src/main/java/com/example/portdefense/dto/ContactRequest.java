package com.example.portdefense.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ContactRequest(
        @NotBlank @Size(max = 140) String subject,
        @NotBlank @Size(max = 4000) String message
) {
}
