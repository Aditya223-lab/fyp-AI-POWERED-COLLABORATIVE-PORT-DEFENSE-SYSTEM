package com.example.portdefense.repository;

import com.example.portdefense.domain.Severity;
import com.example.portdefense.domain.Threat;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;

public interface
ThreatRepository extends JpaRepository<Threat, String> {

    List<Threat> findAllByOrderByTimestampDesc(Pageable pageable);

    List<Threat> findByOrganizationIdOrderByTimestampDesc(String organizationId);

    List<Threat> findBySeverityOrderByTimestampDesc(Severity severity, Pageable pageable);

    long countBySeverity(Severity severity);

    long countByIsZeroDayTrue();

    long countByTimestampAfter(Instant after);

    @Query("select count(t) from Threat t where t.timestamp >= :after")
    long countRecent(@Param("after") Instant after);

    List<Threat> findByTimestampAfter(Instant after);
}
