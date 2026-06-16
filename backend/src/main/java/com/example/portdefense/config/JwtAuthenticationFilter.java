package com.example.portdefense.config;

import com.example.portdefense.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith(BEARER)) {
            chain.doFilter(request, response);
            return;
        }
        String token = header.substring(BEARER.length()).trim();
        try {
            JwtService.Claims c = jwtService.parse(token);
            // role on the JWT may be a Spring-style "ADMIN" or a frontend-style "admin"
            String roleAuthority = "ROLE_" + c.role().toUpperCase();
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    c.subject(),
                    null,
                    List.of(new SimpleGrantedAuthority(roleAuthority)));
            SecurityContext ctx = SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(auth);
            SecurityContextHolder.setContext(ctx);
        } catch (JwtService.InvalidTokenException e) {
            // Leave the context anonymous; the authorization layer will 401/403 as configured.
            SecurityContextHolder.clearContext();
        }
        chain.doFilter(request, response);
    }
}
