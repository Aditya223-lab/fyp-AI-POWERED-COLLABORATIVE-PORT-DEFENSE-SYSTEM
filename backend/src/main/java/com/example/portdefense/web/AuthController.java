package com.example.portdefense.web;

import com.example.portdefense.domain.User;
import com.example.portdefense.dto.LoginRequest;
import com.example.portdefense.dto.RegisterRequest;
import com.example.portdefense.dto.UserDto;
import com.example.portdefense.repository.UserRepository;
import com.example.portdefense.service.AuthService;
import com.example.portdefense.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepo;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();
    private final SecurityContextHolderStrategy holderStrategy = SecurityContextHolder.getContextHolderStrategy();

    public AuthController(AuthService authService,
                          UserRepository userRepo,
                          AuthenticationManager authenticationManager,
                          JwtService jwtService) {
        this.authService = authService;
        this.userRepo = userRepo;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        try {
            User u = authService.register(req);
            return ResponseEntity.status(HttpStatus.CREATED).body(UserDto.of(u));
        } catch (AuthService.EmailAlreadyUsedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "email_already_used"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req,
                                   HttpServletRequest request,
                                   HttpServletResponse response) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.email().trim().toLowerCase(), req.password()));

            SecurityContext context = holderStrategy.createEmptyContext();
            context.setAuthentication(auth);
            holderStrategy.setContext(context);
            securityContextRepository.saveContext(context, request, response);

            User u = userRepo.findByEmailIgnoreCase(auth.getName()).orElseThrow();
            String token = jwtService.sign(u.getEmail(), u.getRole().name(), "free");
            return ResponseEntity.ok(Map.of(
                    "user", UserDto.of(u),
                    "accessToken", token
            ));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "invalid_credentials"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        holderStrategy.clearContext();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        Authentication auth = holderStrategy.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return userRepo.findByEmailIgnoreCase(auth.getName())
                .<ResponseEntity<?>>map(u -> ResponseEntity.ok(UserDto.of(u)))
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
}
