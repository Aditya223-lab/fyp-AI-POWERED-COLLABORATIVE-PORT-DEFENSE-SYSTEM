package com.example.portdefense.config;

import com.example.portdefense.service.JwtService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.List;

@Configuration
public class
SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter(JwtService jwtService) {
        return new JwtAuthenticationFilter(jwtService);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           JwtAuthenticationFilter jwtFilter) throws Exception {
        http
                .cors(c -> c.configurationSource(corsSource()))
                // We auth via Bearer JWT (frontend) and session cookie (direct
                // /api/auth/login users). CSRF is unnecessary for the Bearer
                // path; session callers are localhost-only in this demo.
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(reg -> reg
                        // Public surface: auth endpoints, SSE stream, H2 console,
                        // health probe, and the read-only dashboard / data API
                        // (matches the original demo behavior — anyone hitting
                        // localhost can view the simulation).
                        .requestMatchers(
                                "/api/auth/**",
                                "/ws/**",
                                "/h2/**",
                                "/api/events/**",
                                "/api/dashboard/**",
                                "/api/targets/**",
                                "/api/reports/**",
                                "/actuator/health",
                                "/error"
                        ).permitAll()
                        // Threat and organization reads are public; writes
                        // (create/update/delete) still need a session -- except
                        // the ML ingest endpoint, which the local python-ml
                        // scanner/simulator posts to without a session.
                        .requestMatchers(HttpMethod.POST, "/api/threats/ingest").permitAll()
                        // SIEM log shippers post here without a login (local).
                        .requestMatchers(HttpMethod.POST, "/api/logs/ingest").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/logs/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/threats/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/alerts/**").permitAll()
                        // Correlation rules: anyone may read the list; only an
                        // admin may enable/disable a rule.
                        .requestMatchers(HttpMethod.GET, "/api/rules/**").permitAll()
                        .requestMatchers(HttpMethod.PATCH, "/api/rules/**").hasRole("ADMIN")
                        // Premium analysts may triage (PATCH review / status), but
                        // deleting threats & alerts is admin-only.
                        .requestMatchers(HttpMethod.DELETE, "/api/threats/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/alerts/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/organizations/**").permitAll()
                        // Active response (blocking IPs at the host firewall) is
                        // admin-only — it changes the machine's firewall.
                        .requestMatchers("/api/response/**").hasRole("ADMIN")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll()
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .headers(h -> h.frameOptions(f -> f.disable()));

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(List.of("http://localhost:*", "http://127.0.0.1:*"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setExposedHeaders(List.of("Authorization", "Content-Type"));
        cfg.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}
