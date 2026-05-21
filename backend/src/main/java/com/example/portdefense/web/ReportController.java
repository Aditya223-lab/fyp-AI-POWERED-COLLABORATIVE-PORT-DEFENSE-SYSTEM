package com.example.portdefense.web;

import com.example.portdefense.domain.Report;
import com.example.portdefense.dto.GenerateReportRequest;
import com.example.portdefense.dto.ReportDto;
import com.example.portdefense.service.ReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping
    public List<ReportDto> list(
            @RequestParam(value = "generatedBy", required = false) String generatedBy) {
        return generatedBy == null || generatedBy.isBlank()
                ? reportService.list()
                : reportService.listByGenerator(generatedBy);
    }

    @PostMapping
    public ResponseEntity<ReportDto> generate(@RequestBody(required = false) GenerateReportRequest req) {
        return ResponseEntity.ok(reportService.generate(req));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(
            @PathVariable String id,
            @RequestParam(defaultValue = "html") String format) {
        Report r = reportService.getOrNull(id);
        if (r == null) return ResponseEntity.notFound().build();

        String body;
        MediaType mime;
        String filename;
        if ("json".equalsIgnoreCase(format)) {
            body = r.getContentJson() == null ? "{}" : r.getContentJson();
            mime = MediaType.APPLICATION_JSON;
            filename = r.getId() + ".json";
        } else {
            body = r.getContentHtml() == null ? "<!doctype html><html><body></body></html>" : r.getContentHtml();
            mime = MediaType.TEXT_HTML;
            filename = r.getId() + ".html";
        }
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(mime)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .body(bytes);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        return reportService.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
