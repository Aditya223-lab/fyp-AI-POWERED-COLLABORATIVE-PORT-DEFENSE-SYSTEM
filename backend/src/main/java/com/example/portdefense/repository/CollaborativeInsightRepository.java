package com.example.portdefense.repository;

import com.example.portdefense.domain.CollaborativeInsight;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CollaborativeInsightRepository extends JpaRepository<CollaborativeInsight, String> {
    List<CollaborativeInsight> findAllByOrderByTimestampDesc();
}
