package com.example.portdefense.service;

import com.example.portdefense.domain.Organization;
import com.example.portdefense.domain.Threat;
import com.example.portdefense.dto.Mapper;
import com.example.portdefense.dto.ThreatEventDto;
import com.example.portdefense.repository.OrganizationRepository;
import com.example.portdefense.repository.ThreatRepository;
import com.example.portdefense.web.EventsController;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class LiveThreatPublisher {

    private final ThreatRepository threatRepository;
    private final OrganizationRepository organizationRepository;
    private final ThreatGenerator generator;
    private final SimpMessagingTemplate broker;
    private final EventsController sse;

    public LiveThreatPublisher(ThreatRepository threatRepository,
                               OrganizationRepository organizationRepository,
                               ThreatGenerator generator,
                               SimpMessagingTemplate broker,
                               EventsController sse) {
        this.threatRepository = threatRepository;
        this.organizationRepository = organizationRepository;
        this.generator = generator;
        this.broker = broker;
        this.sse = sse;
    }

    @Scheduled(fixedDelay = 3000L, initialDelay = 4000L)
    public void emitNext() {
        List<Organization> orgs = organizationRepository.findAll();
        if (orgs.isEmpty()) return;

        Threat t = generator.generate(orgs, 0);
        threatRepository.save(t);

        ThreatEventDto dto = Mapper.toDto(t);
        broker.convertAndSend("/topic/threats", dto);
        sse.broadcast(dto);
    }

    @Scheduled(fixedRate = 25000L)
    public void keepalive() {
        sse.ping();
    }
}
