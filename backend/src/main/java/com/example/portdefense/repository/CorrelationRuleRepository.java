package com.example.portdefense.repository;

import com.example.portdefense.domain.CorrelationRule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CorrelationRuleRepository extends JpaRepository<CorrelationRule, String> {
    List<CorrelationRule> findAllByOrderByNameAsc();
    List<CorrelationRule> findByEnabledTrue();
}
