package com.example.portdefense.service;

import com.example.portdefense.dto.AttackPredictionDto;
import com.example.portdefense.dto.Mapper;
import com.example.portdefense.repository.AttackPredictionRepository;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class PredictionService {

    private final AttackPredictionRepository repo;

    public PredictionService(AttackPredictionRepository repo) {
        this.repo = repo;
    }

    public List<AttackPredictionDto> getAll() {
        return repo.findAllByOrderByTimestampAsc().stream().map(Mapper::toDto).toList();
    }

    public long countPredictedAttacks() {
        return repo.findAll().stream().mapToInt(p -> p.getPredictedCount()).sum();
    }
}
