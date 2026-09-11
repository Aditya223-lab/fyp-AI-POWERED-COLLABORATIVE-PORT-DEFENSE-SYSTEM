package com.example.portdefense.repository;

import com.example.portdefense.domain.FileScan;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface FileScanRepository extends JpaRepository<FileScan, String> {

    List<FileScan> findAllByOrderBySubmittedAtDesc(Pageable page);

    /** Most recent completed verdict for a hash — lets a repeat scan skip the API. */
    Optional<FileScan> findFirstBySha256AndVerdictNotOrderBySubmittedAtDesc(
            String sha256, String verdict);
}
