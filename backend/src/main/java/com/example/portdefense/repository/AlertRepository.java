package com.example.portdefense.repository;

import com.example.portdefense.domain.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AlertRepository extends JpaRepository<Alert, String> {
    List<Alert> findAllByOrderByTimestampDesc();
    List<Alert> findByOrganizationIdOrderByTimestampDesc(String organizationId);
}
