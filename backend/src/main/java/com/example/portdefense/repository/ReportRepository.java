package com.example.portdefense.repository;

import com.example.portdefense.domain.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReportRepository extends JpaRepository<Report, String> {
    List<Report> findAllByOrderByGeneratedAtDesc();
    List<Report> findByGeneratedByIgnoreCaseOrderByGeneratedAtDesc(String generatedBy);
}
