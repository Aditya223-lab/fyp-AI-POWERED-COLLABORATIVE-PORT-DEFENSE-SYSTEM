package com.example.portdefense.repository;

import com.example.portdefense.domain.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrganizationRepository extends JpaRepository<Organization, String> {
    List<Organization> findByOwnerEmailIgnoreCase(String ownerEmail);
}
