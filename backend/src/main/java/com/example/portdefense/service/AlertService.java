package com.example.portdefense.service;

import com.example.portdefense.dto.AlertDto;
import com.example.portdefense.dto.Mapper;
import com.example.portdefense.repository.AlertRepository;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class AlertService {

    private final AlertRepository repo;

    public AlertService(AlertRepository repo) {
        this.repo = repo;
    }

    public List<AlertDto> getAll() {
        return repo.findAllByOrderByTimestampDesc().stream().map(Mapper::toDto).toList();
    }

    public List<AlertDto> getForOrganization(String organizationId) {
        return repo.findByOrganizationIdOrderByTimestampDesc(organizationId)
                .stream().map(Mapper::toDto).toList();
    }
}
