package com.zeko.agentdesign.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeko.agentdesign.application.AgentRepository;
import com.zeko.agentdesign.domain.AgentInstance;
import com.zeko.agentdesign.domain.AgentTemplate;
import com.zeko.agentdesign.domain.TemplateUpdateDecision;
import com.zeko.agentdesign.domain.TemplateVersion;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@org.springframework.stereotype.Repository
public class JdbcAgentRepository implements AgentRepository {

    private static final TypeReference<LinkedHashMap<String, Object>> CONFIGURATION_MAP = new TypeReference<>() { };
    private static final TypeReference<LinkedHashMap<String, String>> CONTEXT_MAP = new TypeReference<>() { };

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public JdbcAgentRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public void saveTemplate(AgentTemplate template) {
        TemplateVersion current = template.currentVersion();
        jdbcTemplate.update(
                "INSERT INTO agent_templates (id, project_id, name, version) VALUES (?, ?, ?, ?)",
                template.id().asString(), template.projectId().asString(), template.name(), current.number());
        template.versions().forEach(this::insertVersion);
    }

    @Override
    @Transactional
    public void appendVersion(ResourceId templateId, int expectedCurrentVersion, TemplateVersion version) {
        if (!templateId.equals(version.templateId()) || version.number() != expectedCurrentVersion + 1) {
            throw DomainError.validation("La siguiente version no coincide con la plantilla actual");
        }

        int updated = jdbcTemplate.update(
                "UPDATE agent_templates SET version = version + 1, updated_at = CURRENT_TIMESTAMP "
                        + "WHERE id = ? AND version = ?",
                templateId.asString(), expectedCurrentVersion);
        if (updated != 1) {
            throw DomainError.conflict("La plantilla fue modificada por otra operacion");
        }
        insertVersion(version);
    }

    @Override
    public Optional<AgentTemplate> findTemplateById(ResourceId templateId) {
        return jdbcTemplate.query(
                        "SELECT id, project_id, name FROM agent_templates WHERE id = ?",
                        (row, index) -> template(row), templateId.asString())
                .stream()
                .findFirst();
    }

    @Override
    public List<AgentTemplate> findTemplatesByProjectId(ResourceId projectId) {
        return jdbcTemplate.query(
                "SELECT id, project_id, name FROM agent_templates WHERE project_id = ? ORDER BY created_at, id",
                (row, index) -> template(row), projectId.asString());
    }

    @Override
    @Transactional
    public void saveInstance(AgentInstance instance) {
        jdbcTemplate.update(
                "INSERT INTO agent_instances "
                        + "(id, project_id, template_id, selected_template_version, identity, context, state) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
                        + "selected_template_version = excluded.selected_template_version, "
                        + "identity = excluded.identity, "
                        + "context = excluded.context, state = excluded.state, updated_at = CURRENT_TIMESTAMP, "
                        + "version = agent_instances.version + 1",
                instance.id().asString(), instance.projectId().asString(), instance.templateId().asString(),
                instance.selectedTemplateVersion(), instance.identity(), serialize(instance.context()),
                instance.state());
    }

    @Override
    public Optional<AgentInstance> findInstanceById(ResourceId instanceId) {
        return jdbcTemplate.query(
                        "SELECT id, project_id, template_id, selected_template_version, identity, context, state "
                                + "FROM agent_instances WHERE id = ?",
                        (row, index) -> instance(row), instanceId.asString())
                .stream()
                .findFirst();
    }

    @Override
    public List<AgentInstance> findInstancesByProjectId(ResourceId projectId) {
        return jdbcTemplate.query(
                "SELECT id, project_id, template_id, selected_template_version, identity, context, state "
                        + "FROM agent_instances WHERE project_id = ? ORDER BY created_at, id",
                (row, index) -> instance(row), projectId.asString());
    }

    @Override
    public void recordDecision(TemplateUpdateDecision decision) {
        jdbcTemplate.update(
                "INSERT INTO template_update_decisions (id, instance_id, previous_template_version, "
                        + "proposed_template_version, outcome, decided_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                decision.id().asString(), decision.instanceId().asString(), decision.previousTemplateVersion(),
                decision.proposedTemplateVersion(), decision.outcome().name(), decision.decidedAt().toString());
    }

    @Override
    public List<TemplateUpdateDecision> findDecisionsByInstanceId(ResourceId instanceId) {
        return jdbcTemplate.query(
                "SELECT id, instance_id, previous_template_version, proposed_template_version, outcome, "
                        + "decided_at "
                        + "FROM template_update_decisions WHERE instance_id = ? ORDER BY decided_at, id",
                (row, index) -> decision(row), instanceId.asString());
    }

    private void insertVersion(TemplateVersion version) {
        jdbcTemplate.update(
                "INSERT INTO template_versions (id, template_id, number, configuration, created_at) "
                        + "VALUES (?, ?, ?, ?, ?)",
                version.id().asString(), version.templateId().asString(), version.number(),
                serialize(version.configuration()), version.createdAt().toString());
    }

    private AgentTemplate template(ResultSet row) throws SQLException {
        ResourceId templateId = ResourceId.parse(row.getString("id"));
        List<TemplateVersion> versions = jdbcTemplate.query(
                "SELECT id, template_id, number, configuration, created_at FROM template_versions "
                        + "WHERE template_id = ? ORDER BY number",
                (versionRow, index) -> version(versionRow), templateId.asString());
        return new AgentTemplate(
                templateId, ResourceId.parse(row.getString("project_id")), row.getString("name"), versions);
    }

    private TemplateVersion version(ResultSet row) throws SQLException {
        return new TemplateVersion(
                ResourceId.parse(row.getString("id")), ResourceId.parse(row.getString("template_id")),
                row.getInt("number"), deserializeConfiguration(row.getString("configuration")),
                Instant.parse(row.getString("created_at")));
    }

    private AgentInstance instance(ResultSet row) throws SQLException {
        return new AgentInstance(
                ResourceId.parse(row.getString("id")), ResourceId.parse(row.getString("project_id")),
                ResourceId.parse(row.getString("template_id")), row.getInt("selected_template_version"),
                row.getString("identity"), deserializeContext(row.getString("context")), row.getString("state"));
    }

    private TemplateUpdateDecision decision(ResultSet row) throws SQLException {
        return new TemplateUpdateDecision(
                ResourceId.parse(row.getString("id")), ResourceId.parse(row.getString("instance_id")),
                row.getInt("previous_template_version"), row.getInt("proposed_template_version"),
                TemplateUpdateDecision.Outcome.valueOf(row.getString("outcome")),
                Instant.parse(row.getString("decided_at")));
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("No se pudo serializar el agente", error);
        }
    }

    private Map<String, Object> deserializeConfiguration(String json) {
        try {
            return objectMapper.readValue(json, CONFIGURATION_MAP);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("No se pudo leer la configuracion de plantilla", error);
        }
    }

    private Map<String, String> deserializeContext(String json) {
        try {
            return objectMapper.readValue(json, CONTEXT_MAP);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("No se pudo leer el contexto de instancia", error);
        }
    }
}
