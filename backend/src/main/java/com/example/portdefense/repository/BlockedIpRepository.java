package com.example.portdefense.repository;

import com.example.portdefense.domain.BlockedIp;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface BlockedIpRepository extends JpaRepository<BlockedIp, String> {

    List<BlockedIp> findAllByOrderByCreatedAtDesc();

    Optional<BlockedIp> findFirstByIpAddressAndStatusOrderByCreatedAtDesc(
            String ipAddress, String status);
}
