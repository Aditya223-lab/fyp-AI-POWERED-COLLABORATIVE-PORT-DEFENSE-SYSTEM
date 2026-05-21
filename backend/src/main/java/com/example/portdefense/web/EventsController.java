package com.example.portdefense.web;

import com.example.portdefense.dto.ThreatEventDto;
import com.example.portdefense.service.ThreatService;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Controller
@RequestMapping("/api/events")
public class EventsController {

    private final ThreatService threatService;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public EventsController(ThreatService threatService) {
        this.threatService = threatService;
    }

    @GetMapping(path = "/threats", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(ex -> emitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("hello")
                    .data(Map.of("connected", true, "ts", System.currentTimeMillis())));

            for (ThreatEventDto t : threatService.getRecent(5)) {
                emitter.send(SseEmitter.event().name("threat").data(t));
            }
        } catch (IOException e) {
            emitters.remove(emitter);
        }

        return emitter;
    }

    public void broadcast(ThreatEventDto dto) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("threat").data(dto));
            } catch (IOException | IllegalStateException e) {
                emitter.complete();
                emitters.remove(emitter);
            }
        }
    }

    public void ping() {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("ping")
                        .data(Map.of("ts", System.currentTimeMillis())));
            } catch (IOException | IllegalStateException e) {
                emitter.complete();
                emitters.remove(emitter);
            }
        }
    }
}
