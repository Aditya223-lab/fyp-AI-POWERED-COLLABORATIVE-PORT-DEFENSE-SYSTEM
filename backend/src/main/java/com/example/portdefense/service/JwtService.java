package com.example.portdefense.service;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {

    public record Claims(String subject, String role, String plan) {}

    public static class InvalidTokenException extends RuntimeException {
        public InvalidTokenException(String msg, Throwable cause) { super(msg, cause); }
    }

    private final SecretKey key;
    private final long ttlSeconds;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.ttl-seconds:1800}") long ttlSeconds) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException(
                    "app.jwt.secret must be at least 32 characters (256 bits). " +
                    "Set the same value as the frontend's APP_JWT_SECRET.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttlSeconds = ttlSeconds;
    }

    public String sign(String subject, String role, String plan) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(subject)
                .claim("role", role)
                .claim("plan", plan == null ? "free" : plan)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(ttlSeconds)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public Claims parse(String token) {
        try {
            io.jsonwebtoken.Claims c = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String role = String.valueOf(c.getOrDefault("role", "USER"));
            String plan = String.valueOf(c.getOrDefault("plan", "free"));
            return new Claims(c.getSubject(), role, plan);
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException("Invalid JWT", e);
        }
    }
}
