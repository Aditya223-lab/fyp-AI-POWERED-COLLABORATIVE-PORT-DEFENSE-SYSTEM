package com.example.portdefense.repository;

import com.example.portdefense.domain.MonitorTarget;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MonitorTargetRepository extends JpaRepository<MonitorTarget, String> {
    List<MonitorTarget> findAllByOrderByCreatedAtDesc();
}
