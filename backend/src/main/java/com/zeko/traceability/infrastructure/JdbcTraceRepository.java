package com.zeko.traceability.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeko.sharedkernel.domain.ResourceId;
import com.zeko.traceability.application.TraceRepository;
import com.zeko.traceability.domain.SafeDetail;
import com.zeko.traceability.domain.TraceLink;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcTraceRepository implements TraceRepository {

    private static final TypeReference<LinkedHashMap<String, String>> DETAIL_MAP = new TypeReference<>() { };

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public JdbcTraceRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void record(TraceLink link, SafeDetail detail) {
        jdbcTemplate.update(
                "INSERT INTO trace_links (id, source_type, source_id, target_type, target_id, relation, created_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?)",
                link.id().asString(), link.sourceType(), link.sourceId().asString(), link.targetType(),
                link.targetId().asString(), link.relation(), link.createdAt().toString());
        jdbcTemplate.update("INSERT INTO trace_events (trace_link_id, safe_detail) VALUES (?, ?)",
                link.id().asString(), serialize(detail));
    }

    @Override
    public List<RecordedTrace> findByResource(ResourceId resourceId) {
        return jdbcTemplate.query(
                "SELECT l.id, l.source_type, l.source_id, l.target_type, l.target_id, l.relation, l.created_at, "
                        + "e.safe_detail FROM trace_links l JOIN trace_events e ON e.trace_link_id = l.id "
                        + "WHERE l.source_id = ? OR l.target_id = ? ORDER BY l.created_at, l.id",
                (resultSet, rowNumber) -> map(resultSet), resourceId.asString(), resourceId.asString());
    }

    private String serialize(SafeDetail detail) {
        try {
            return objectMapper.writeValueAsString(detail.values());
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("No se pudo serializar el detalle seguro", error);
        }
    }

    private RecordedTrace map(ResultSet row) throws SQLException {
        TraceLink link = new TraceLink(
                ResourceId.parse(row.getString("id")), row.getString("source_type"),
                ResourceId.parse(row.getString("source_id")), row.getString("target_type"),
                ResourceId.parse(row.getString("target_id")), row.getString("relation"),
                Instant.parse(row.getString("created_at")));
        return new RecordedTrace(link, SafeDetail.of(deserialize(row.getString("safe_detail"))));
    }

    private Map<String, String> deserialize(String json) {
        try {
            return objectMapper.readValue(json, DETAIL_MAP);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("No se pudo leer el detalle seguro", error);
        }
    }
}
