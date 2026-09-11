package com.example.portdefense.repository;

import com.example.portdefense.domain.MonitorTarget;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MonitorTargetRepository extends JpaRepository<MonitorTarget, String> {
    List<MonitorTarget> findAllByOrderByCreatedAtDesc();

    /**
     * A customer's own assets plus the shared demo ones (ownerEmail IS NULL),
     * so a premium account always has something live to look at.
     */
    List<MonitorTarget> findByOwnerEmailIgnoreCaseOrOwnerEmailIsNullOrderByCreatedAtDesc(String ownerEmail);
}
