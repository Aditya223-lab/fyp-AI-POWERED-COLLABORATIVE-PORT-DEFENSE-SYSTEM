package com.example.portdefense.repository;

import com.example.portdefense.domain.LogEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;

public interface LogEventRepository extends JpaRepository<LogEvent, String> {

    List<LogEvent> findAllByOrderByTimestampDesc(Pageable pageable);

    /**
     * Analyst search, evaluated in the database over the whole table — not over
     * a recent slice — so an IP seen an hour ago is still findable.
     *
     * `like` is the caller's free-text term already lower-cased and wrapped in
     * %…%; `port` is that same term parsed as a number when it looks like one,
     * so searching "3306" finds events by port and not only by message text.
     * Every filter is skipped when its parameter is null.
     */
    @Query("""
            select e from LogEvent e
            where (:source is null or lower(e.source) = :source)
              and (:eventType is null or lower(e.eventType) = :eventType)
              and (:sourceIP is null or e.sourceIP = :sourceIP)
              and (:like is null
                   or lower(e.sourceIP) like :like escape '\\'
                   or lower(e.message) like :like escape '\\'
                   or lower(e.username) like :like escape '\\'
                   or lower(e.eventType) like :like escape '\\'
                   or lower(e.source) like :like escape '\\'
                   or lower(e.rawLine) like :like escape '\\'
                   or e.targetPort = :port)
            order by e.timestamp desc
            """)
    List<LogEvent> search(@Param("source") String source,
                          @Param("eventType") String eventType,
                          @Param("sourceIP") String sourceIP,
                          @Param("like") String like,
                          @Param("port") Integer port,
                          Pageable pageable);

    // Correlation engine: pull the events a rule cares about within its window.
    List<LogEvent> findByEventTypeAndTimestampAfter(String eventType, Instant after);

    List<LogEvent> findBySourceAndEventTypeAndTimestampAfter(
            String source, String eventType, Instant after);

    long countByTimestampAfter(Instant after);
}
