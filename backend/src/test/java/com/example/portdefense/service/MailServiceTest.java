package com.example.portdefense.service;

import com.example.portdefense.domain.Alert;
import com.example.portdefense.domain.AlertSeverity;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class MailServiceTest {

    private MailService build(JavaMailSender sender, boolean contactEnabled, boolean alertsEnabled) {
        return new MailService(sender, "noreply@portdefense.local", "admin@portdefense.local",
                contactEnabled, alertsEnabled);
    }

    @Test
    void sendContactEmail_buildsExpectedMessage() {
        JavaMailSender sender = mock(JavaMailSender.class);
        MailService svc = build(sender, true, false);

        boolean sent = svc.sendContactEmail("alice@example.com", "Alice",
                "Bug in the dashboard", "Pie chart shows NaN on Safari.");

        assertTrue(sent);
        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(captor.capture());
        SimpleMailMessage msg = captor.getValue();

        assertEquals("noreply@portdefense.local", msg.getFrom());
        assertNotNull(msg.getTo());
        assertEquals(1, msg.getTo().length);
        assertEquals("admin@portdefense.local", msg.getTo()[0]);
        assertNotNull(msg.getReplyTo());
        assertEquals("alice@example.com", msg.getReplyTo());
        assertTrue(msg.getSubject().contains("Bug in the dashboard"));
        assertTrue(msg.getText().contains("Alice"));
        assertTrue(msg.getText().contains("alice@example.com"));
        assertTrue(msg.getText().contains("Pie chart shows NaN on Safari."));
    }

    @Test
    void sendContactEmail_noopWhenDisabled() {
        JavaMailSender sender = mock(JavaMailSender.class);
        MailService svc = build(sender, false, false);

        boolean sent = svc.sendContactEmail("alice@example.com", "Alice", "Hi", "Hello.");

        assertFalse(sent);
        verify(sender, never()).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
    }

    @Test
    void sendContactEmail_propagatesMailException() {
        JavaMailSender sender = mock(JavaMailSender.class);
        doThrow(new MailSendException("smtp down")).when(sender).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
        MailService svc = build(sender, true, false);

        assertThrows(MailSendException.class,
                () -> svc.sendContactEmail("alice@example.com", "Alice", "Hi", "Hello."));
    }

    @Test
    void sendAlertEmail_noopWhenAlertsDisabled() {
        JavaMailSender sender = mock(JavaMailSender.class);
        MailService svc = build(sender, true, false);

        Alert a = newAlert();
        svc.sendAlertEmail(a);

        verify(sender, never()).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
    }

    @Test
    void sendAlertEmail_buildsExpectedMessageWhenEnabled() {
        JavaMailSender sender = mock(JavaMailSender.class);
        MailService svc = build(sender, true, true);

        Alert a = newAlert();
        svc.sendAlertEmail(a);

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(captor.capture());
        SimpleMailMessage msg = captor.getValue();

        assertTrue(msg.getSubject().contains(a.getTitle()));
        assertTrue(msg.getText().contains(a.getId()));
        assertTrue(msg.getText().contains(a.getDescription()));
    }

    @Test
    void sendAlertEmail_swallowsMailException() {
        JavaMailSender sender = mock(JavaMailSender.class);
        doThrow(new MailSendException("smtp down")).when(sender).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
        MailService svc = build(sender, true, true);

        // Must not throw - ingest path depends on this.
        svc.sendAlertEmail(newAlert());
        verify(sender).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
    }

    private Alert newAlert() {
        Alert a = new Alert();
        a.setId("alert-test123");
        a.setTitle("Critical port scan from 203.0.113.5");
        a.setDescription("Detected a CRITICAL port scan targeting port 22 (SSH).");
        a.setSeverity(AlertSeverity.CRITICAL);
        a.setSource("AI-Classifier");
        a.setTimestamp(Instant.parse("2026-05-28T12:34:56Z"));
        a.setActionRequired(true);
        return a;
    }
}
