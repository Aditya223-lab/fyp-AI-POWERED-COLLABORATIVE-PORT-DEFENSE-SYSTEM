package com.example.portdefense.repository;

import com.example.portdefense.domain.AttackPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AttackPredictionRepository extends JpaRepository<AttackPrediction, String> {
    List<AttackPrediction> findAllByOrderByTimestampAsc();
}
