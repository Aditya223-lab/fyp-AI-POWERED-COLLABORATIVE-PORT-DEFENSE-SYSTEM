package com.example.portdefense.web;

import com.example.portdefense.domain.User;
import com.example.portdefense.dto.ContactRequest;
import com.example.portdefense.repository.UserRepository;
import com.example.portdefense.service.MailService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.MailException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/contact")
public class ContactController {

    private static final Logger log = LoggerFactory.getLogger(ContactController.class);

    private final MailService mailService;
    private final UserRepository userRepo;

    public ContactController(MailService mailService, UserRepository userRepo) {
        this.mailService = mailService;
        this.userRepo = userRepo;
    }

    @PostMapping
    public ResponseEntity<?> submit(@Valid @RequestBody ContactRequest req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "unauthenticated"));
        }
        if (!mailService.isContactEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "contact_mail_disabled"));
        }

        String email = auth.getName();
        String displayName = userRepo.findByEmailIgnoreCase(email)
                .map(User::getFullName)
                .filter(s -> s != null && !s.isBlank())
                .orElse(email);

        try {
            mailService.sendContactEmail(email, displayName, req.subject(), req.message());
            return ResponseEntity.ok(Map.of("status", "sent"));
        } catch (MailException e) {
            log.warn("[contact] mail send failed for {}: {}", email, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "mail_send_failed", "detail", e.getMessage()));
        }
    }
}
