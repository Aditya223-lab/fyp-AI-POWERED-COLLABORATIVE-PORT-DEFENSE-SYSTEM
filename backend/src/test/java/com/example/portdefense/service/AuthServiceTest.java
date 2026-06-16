package com.example.portdefense.service;

import com.example.portdefense.domain.Role;
import com.example.portdefense.domain.User;
import com.example.portdefense.dto.RegisterRequest;
import com.example.portdefense.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthServiceTest {

    private InMemoryUserRepo repo;
    private PasswordEncoder encoder;
    private AuthService service;

    @BeforeEach
    void setUp() {
        repo = new InMemoryUserRepo();
        encoder = new BCryptPasswordEncoder();
        service = new AuthService(repo, encoder);
    }

    @Test
    void register_hashesPasswordAndDefaultsRoleToUser() {
        User u = service.register(new RegisterRequest("alice@example.com", "supersecret", "Alice"));

        assertNotNull(u.getId());
        assertEquals("alice@example.com", u.getEmail());
        assertEquals(Role.USER, u.getRole());
        assertTrue(u.isEnabled());
        assertNotEquals("supersecret", u.getPasswordHash(), "password must not be stored in plaintext");
        assertTrue(encoder.matches("supersecret", u.getPasswordHash()));
    }

    @Test
    void register_normalizesEmailCase() {
        User u = service.register(new RegisterRequest("  Bob@Example.COM ", "supersecret", "Bob"));
        assertEquals("bob@example.com", u.getEmail());
    }

    @Test
    void register_rejectsDuplicateEmail() {
        service.register(new RegisterRequest("dup@example.com", "supersecret", "First"));
        assertThrows(AuthService.EmailAlreadyUsedException.class,
                () -> service.register(new RegisterRequest("DUP@example.com", "another", "Second")));
    }

    @Test
    void register_canCreateAdminViaOverload() {
        User u = service.register("admin@example.com", "supersecret", "Admin", Role.ADMIN);
        assertEquals(Role.ADMIN, u.getRole());
    }

    /** Minimal in-memory UserRepository that only implements the methods AuthService touches. */
    private static class InMemoryUserRepo implements UserRepository {
        private final Map<String, User> byId = new HashMap<>();

        @Override
        public Optional<User> findByEmailIgnoreCase(String email) {
            return byId.values().stream()
                    .filter(u -> u.getEmail().equalsIgnoreCase(email))
                    .findFirst();
        }

        @Override
        public boolean existsByEmailIgnoreCase(String email) {
            return findByEmailIgnoreCase(email).isPresent();
        }

        @Override
        public <S extends User> S save(S entity) {
            byId.put(entity.getId(), entity);
            return entity;
        }

        // --- Unused JpaRepository methods ---
        @Override public java.util.List<User> findAll() { return java.util.List.copyOf(byId.values()); }
        @Override public java.util.List<User> findAll(org.springframework.data.domain.Sort sort) { return findAll(); }
        @Override public org.springframework.data.domain.Page<User> findAll(org.springframework.data.domain.Pageable pageable) { throw new UnsupportedOperationException(); }
        @Override public java.util.List<User> findAllById(Iterable<String> ids) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> java.util.List<S> saveAll(Iterable<S> entities) { throw new UnsupportedOperationException(); }
        @Override public Optional<User> findById(String s) { return Optional.ofNullable(byId.get(s)); }
        @Override public boolean existsById(String s) { return byId.containsKey(s); }
        @Override public long count() { return byId.size(); }
        @Override public void deleteById(String s) { byId.remove(s); }
        @Override public void delete(User entity) { byId.remove(entity.getId()); }
        @Override public void deleteAllById(Iterable<? extends String> strings) { strings.forEach(byId::remove); }
        @Override public void deleteAll(Iterable<? extends User> entities) { entities.forEach(this::delete); }
        @Override public void deleteAll() { byId.clear(); }
        @Override public void flush() {}
        @Override public <S extends User> S saveAndFlush(S entity) { return save(entity); }
        @Override public <S extends User> java.util.List<S> saveAllAndFlush(Iterable<S> entities) { throw new UnsupportedOperationException(); }
        @Override public void deleteAllInBatch(Iterable<User> entities) { throw new UnsupportedOperationException(); }
        @Override public void deleteAllByIdInBatch(Iterable<String> ids) { throw new UnsupportedOperationException(); }
        @Override public void deleteAllInBatch() { byId.clear(); }
        @Override public User getOne(String s) { return byId.get(s); }
        @Override public User getById(String s) { return byId.get(s); }
        @Override public User getReferenceById(String s) { return byId.get(s); }
        @Override public <S extends User> java.util.List<S> findAll(org.springframework.data.domain.Example<S> example) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> java.util.List<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Sort sort) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> Optional<S> findOne(org.springframework.data.domain.Example<S> example) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> org.springframework.data.domain.Page<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Pageable pageable) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> long count(org.springframework.data.domain.Example<S> example) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> boolean exists(org.springframework.data.domain.Example<S> example) { throw new UnsupportedOperationException(); }
        @Override public <S extends User, R> R findBy(org.springframework.data.domain.Example<S> example, java.util.function.Function<org.springframework.data.repository.query.FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { throw new UnsupportedOperationException(); }
    }
}
