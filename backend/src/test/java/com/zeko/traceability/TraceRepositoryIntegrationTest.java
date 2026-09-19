package com.zeko.traceability;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.sharedkernel.domain.ResourceId;
import com.zeko.traceability.application.SensitiveDataFilter;
import com.zeko.traceability.application.TraceRecorder;
import com.zeko.traceability.application.TraceRepository.RecordedTrace;
import com.zeko.traceability.domain.TraceLink;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class TraceRepositoryIntegrationTest {

    @TempDir
    static Path localDataDir;

    @Autowired
    private TraceRecorder recorder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void localDatabase(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("traceability.db").toString());
    }

    @Test
    void persistsNavigableLinksAndOrderedSafeEvents() {
        ResourceId taskId = ResourceId.newId();
        ResourceId decisionId = ResourceId.newId();
        ResourceId evidenceId = ResourceId.newId();
        TraceLink first = link(taskId, decisionId, "DECISION", Instant.parse("2026-09-14T12:00:00Z"));
        TraceLink second = link(evidenceId, taskId, "EVIDENCE", Instant.parse("2026-09-14T12:01:00Z"));
        SensitiveDataFilter filter = new SensitiveDataFilter();

        recorder.record(first, filter.filter(java.util.Map.of("summary", "approval recorded")));
        recorder.record(second, filter.filter(java.util.Map.of("token", "synthetic-secret")));

        List<RecordedTrace> traces = recorder.findByResource(taskId);

        assertThat(traces).extracting(trace -> trace.link().id()).containsExactly(first.id(), second.id());
        assertThat(traces.get(0).detail().values()).containsEntry("summary", "approval recorded");
        assertThat(traces.get(1).detail().values()).containsEntry("token", "[REDACTED]");
        String storedDetail = jdbcTemplate.queryForObject(
                "SELECT safe_detail FROM trace_events WHERE trace_link_id = ?", String.class, second.id().asString());
        assertThat(storedDetail).doesNotContain("synthetic-secret");
    }

    private static TraceLink link(ResourceId source, ResourceId target, String targetType, Instant createdAt) {
        return new TraceLink(ResourceId.newId(), "TASK", source, targetType, target, "SUPPORTS", createdAt);
    }
}
