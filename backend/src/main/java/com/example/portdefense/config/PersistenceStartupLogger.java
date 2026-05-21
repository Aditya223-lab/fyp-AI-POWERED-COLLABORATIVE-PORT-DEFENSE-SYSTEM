package com.example.portdefense.config;

import com.example.portdefense.repository.MonitorTargetRepository;
import com.example.portdefense.repository.OrganizationRepository;
import com.example.portdefense.repository.ReportRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

// Prints a clear banner on startup so the developer can confirm where the
// H2 file lives and how many rows already exist. Runs AFTER DataSeeder so
// the counts reflect any first-time seeding.
@Component
@Order(Integer.MAX_VALUE)
public class PersistenceStartupLogger implements CommandLineRunner {

    private final OrganizationRepository orgRepo;
    private final MonitorTargetRepository targetRepo;
    private final ReportRepository reportRepo;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    public PersistenceStartupLogger(OrganizationRepository orgRepo,
                                    MonitorTargetRepository targetRepo,
                                    ReportRepository reportRepo) {
        this.orgRepo = orgRepo;
        this.targetRepo = targetRepo;
        this.reportRepo = reportRepo;
    }

    @Override
    public void run(String... args) throws Exception {
        // Ensure the H2 data/ directory exists (H2 normally creates it, but
        // this makes failures loud instead of silent if the working dir is
        // read-only).
        Path dataDir = Path.of("data");
        if (!Files.exists(dataDir)) {
            Files.createDirectories(dataDir);
        }
        File dbFile = new File("data/portdefense.mv.db");

        System.out.println();
        System.out.println("================================================================");
        System.out.println("  PortDefense persistence");
        System.out.println("    datasource = " + datasourceUrl);
        System.out.println("    db file    = " + dbFile.getAbsolutePath()
                + (dbFile.exists() ? " (" + dbFile.length() + " bytes)" : " (will be created on first write)"));
        System.out.println("    orgs       = " + orgRepo.count());
        System.out.println("    targets    = " + targetRepo.count());
        System.out.println("    reports    = " + reportRepo.count());
        System.out.println("================================================================");
        System.out.println();
    }
}
