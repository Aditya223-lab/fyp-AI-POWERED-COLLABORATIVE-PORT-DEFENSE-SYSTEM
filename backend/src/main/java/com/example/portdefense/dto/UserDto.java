package com.example.portdefense.dto;

import com.example.portdefense.domain.Role;
import com.example.portdefense.domain.User;

public record UserDto(
        String id,
        String email,
        String fullName,
        Role role
) {
    public static UserDto of(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole());
    }
}
