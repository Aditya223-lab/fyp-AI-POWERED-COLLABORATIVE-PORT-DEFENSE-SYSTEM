package com.example.portdefense.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-32+chars";

    @Test
    void sign_then_parse_roundtrips_claims() {
        JwtService svc = new JwtService(SECRET, 60);
        String token = svc.sign("alice@example.com", "ADMIN", "premium");

        assertNotNull(token);
        assertTrue(token.split("\\.").length == 3, "JWT must have header.payload.signature");

        JwtService.Claims c = svc.parse(token);
        assertEquals("alice@example.com", c.subject());
        assertEquals("ADMIN", c.role());
        assertEquals("premium", c.plan());
    }

    @Test
    void parse_rejects_tampered_token() {
        JwtService svc = new JwtService(SECRET, 60);
        String token = svc.sign("alice@example.com", "USER", "free");
        // Flip a byte in the signature segment.
        String[] parts = token.split("\\.");
        char flipped = parts[2].charAt(0) == 'A' ? 'B' : 'A';
        String tampered = parts[0] + "." + parts[1] + "." + flipped + parts[2].substring(1);

        assertThrows(JwtService.InvalidTokenException.class, () -> svc.parse(tampered));
    }

    @Test
    void parse_rejects_token_signed_with_other_secret() {
        JwtService a = new JwtService(SECRET, 60);
        JwtService b = new JwtService("other-secret-other-secret-other-secret-32!", 60);
        String token = a.sign("alice@example.com", "USER", "free");

        assertThrows(JwtService.InvalidTokenException.class, () -> b.parse(token));
    }

    @Test
    void constructor_rejects_short_secret() {
        assertThrows(IllegalStateException.class, () -> new JwtService("short", 60));
    }
}
