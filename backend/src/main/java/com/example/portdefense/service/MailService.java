package com.example.portdefense.service;

import com.example.portdefense.domain.Alert;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.time.format.DateTimeFormatter;

@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender;
    private final String fromAddress;
    private final String adminAddress;
    private final boolean contactEnabled;
    private final boolean alertsEnabled;

    public MailService(JavaMailSender sender,
                       @Value("${app.mail.from}") String fromAddress,
                       @Value("${app.mail.admin}") String adminAddress,
                       @Value("${app.mail.contact.enabled:true}") boolean contactEnabled,
                       @Value("${app.mail.alerts.enabled:false}") boolean alertsEnabled) {
        this.sender = sender;
        this.fromAddress = fromAddress;
        this.adminAddress = adminAddress;
        this.contactEnabled = contactEnabled;
        this.alertsEnabled = alertsEnabled;
    }

    public boolean isContactEnabled() { return contactEnabled; }
    public boolean isAlertsEnabled() { return alertsEnabled; }

    /**
     * Sends a contact-form submission to the admin inbox. Synchronous so the
     * caller can surface a failure to the user.
     *
     * @return true if the mail was dispatched, false if mail is disabled.
     * @throws MailException if the SMTP server rejects the message.
     */
    public boolean sendContactEmail(String fromUserEmail, String fromUserName,
                                    String subject, String message) {
        if (!contactEnabled) {
            log.info("[mail] contact disabled; would have mailed admin from {}", fromUserEmail);
            return false;
        }

        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(fromAddress);
        msg.setTo(adminAddress);
        msg.setReplyTo(fromUserEmail);
        msg.setSubject("[PortDefense contact] " + subject);
        msg.setText(buildContactBody(fromUserEmail, fromUserName, subject, message));

        sender.send(msg);
        log.info("[mail] contact form submitted by {} -> {}", fromUserEmail, adminAddress);
        return true;
    }

    /**
     * Sends a notification when an alert is auto-raised. Async because the
     * caller is the ingest path and we never want SMTP latency to slow it.
     * Swallows exceptions so a misconfigured SMTP setup does not break ingest.
     */
    @Async
    public void sendAlertEmail(Alert alert) {
        if (!alertsEnabled) return;
        if (alert == null) return;

        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromAddress);
            msg.setTo(adminAddress);
            msg.setSubject("[PortDefense alert] " + alert.getTitle());
            msg.setText(buildAlertBody(alert));
            sender.send(msg);
            log.info("[mail] alert email sent for {}", alert.getId());
        } catch (MailException e) {
            log.warn("[mail] failed to send alert email for {}: {}", alert.getId(), e.getMessage());
        }
    }

    private String buildContactBody(String email, String name, String subject, String message) {
        return String.format("""
                You received a new contact-form submission.

                From:    %s <%s>
                Subject: %s

                %s

                ---
                Sent via the PortDefense /contact page.
                """,
                name == null || name.isBlank() ? "(no name)" : name,
                email, subject, message);
    }

    private String buildAlertBody(Alert a) {
        String when = a.getTimestamp() == null
                ? "(unknown time)"
                : DateTimeFormatter.ISO_INSTANT.format(a.getTimestamp());
        return String.format("""
                A new PortDefense alert was raised.

                Alert ID:   %s
                Severity:   %s
                Source:     %s
                Time:       %s
                Org:        %s

                %s

                %s
                """,
                a.getId(),
                a.getSeverity(),
                a.getSource(),
                when,
                a.getOrganizationId() == null ? "(federation-wide)" : a.getOrganizationId(),
                a.getTitle(),
                a.getDescription());
    }
}
