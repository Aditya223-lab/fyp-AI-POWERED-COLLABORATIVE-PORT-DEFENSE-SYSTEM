package com.example.portdefense.repository;

import com.example.portdefense.domain.TargetCheck;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TargetCheckRepository extends JpaRepository<TargetCheck, String> {

    List<TargetCheck> findByTargetIdOrderByCheckedAtDesc(String targetId, Pageable page);

    long countByTargetId(String targetId);

    void deleteByTargetId(String targetId);
}
