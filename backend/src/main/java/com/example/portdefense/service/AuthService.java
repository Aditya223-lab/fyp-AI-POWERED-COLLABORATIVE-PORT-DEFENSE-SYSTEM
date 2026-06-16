package com.example.portdefense.service;

import com.example.portdefense.domain.Role;
import com.example.portdefense.domain.User;
import com.example.portdefense.dto.RegisterRequest;
import com.example.portdefense.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {

    public static class EmailAlreadyUsedException extends RuntimeException {
        public EmailAlreadyUsedException(String email) {
            super("Email already registered: " + email);
        }
    }

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepo, PasswordEncoder passwordEncoder) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
    }

    public User register(RegisterRequest req) {
        return register(req.email(), req.password(), req.fullName(), Role.USER);
    }

    public User register(String email, String rawPassword, String fullName, Role role) {
        String normalized = email.trim().toLowerCase();
        if (userRepo.existsByEmailIgnoreCase(normalized)) {
            throw new EmailAlreadyUsedException(normalized);
        }
        User u = new User();
        u.setId("usr-" + UUID.randomUUID().toString().substring(0, 8));
        u.setEmail(normalized);
        u.setPasswordHash(passwordEncoder.encode(rawPassword));
        u.setFullName(fullName);
        u.setRole(role);
        u.setEnabled(true);
        u.setCreatedAt(Instant.now());
        return userRepo.save(u);
    }
}
