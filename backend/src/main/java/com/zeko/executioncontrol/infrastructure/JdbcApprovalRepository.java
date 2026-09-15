package com.zeko.executioncontrol.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeko.executioncontrol.application.ApprovalRepository;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.Approval;
import com.zeko.executioncontrol.domain.ApprovalDecision;
import com.zeko.executioncontrol.domain.PermissionMode;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@org.springframework.stereotype.Repository
public class JdbcApprovalRepository implements ApprovalRepository {

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() { };
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public JdbcApprovalRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public void savePolicy(PermissionPolicy policy) {
        jdbcTemplate.update(
                "INSERT INTO permission_policies (id, runtime_settings_id, permission_mode, auto_approve_rules, "
                        + "constitutional_prohibitions) VALUES (?, ?, ?, ?, ?) ON CONFLICT(runtime_settings_id) DO "
                        + "UPDATE SET permission_mode = excluded.permission_mode, "
                        + "auto_approve_rules = excluded.auto_approve_rules, "
                        + "constitutional_prohibitions = excluded.constitutional_prohibitions, "
                        + "version = permission_policies.version + 1, updated_at = CURRENT_TIMESTAMP",
                policy.id().asString(), policy.runtimeSettingsId().asString(), policy.mode().name(),
                serialize(policy.autoApproveRules()), serialize(policy.constitutionalProhibitions()));
    }

    @Override
    public Optional<PermissionPolicy> findPolicy(ResourceId runtimeSettingsId) {
        return jdbcTemplate.query(
                        "SELECT id, runtime_settings_id, permission_mode, auto_approve_rules, "
                                + "constitutional_prohibitions FROM permission_policies WHERE runtime_settings_id = ?",
                        (row, index) -> policy(row), runtimeSettingsId.asString())
                .stream().findFirst();
    }

    @Override
    @Transactional
    public void saveAction(ActionProposal proposal) {
        jdbcTemplate.update(
                "INSERT INTO action_proposals (id, execution_id, agent_instance_id, task_id, action_type, "
                        + "current_revision) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
                        + "current_revision = MAX(action_proposals.current_revision, excluded.current_revision), "
                        + "updated_at = CURRENT_TIMESTAMP",
                proposal.id().asString(), proposal.executionId().asString(), nullable(proposal.agentInstanceId()),
                nullable(proposal.taskId()), proposal.type(), proposal.revision());
        int inserted = jdbcTemplate.update(
                "INSERT INTO action_revisions (id, action_proposal_id, revision, resource, scope, working_directory, "
                        + "arguments, network_target, expected_effects, classification) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ResourceId.newId().asString(), proposal.id().asString(), proposal.revision(), proposal.resource(),
                proposal.scope(), proposal.workingDirectory(), serialize(proposal.arguments()),
                proposal.networkTarget(),
                serialize(proposal.expectedEffects()), proposal.classification().name());
        if (inserted != 1) {
            throw DomainError.conflict("La revision de accion no pudo persistirse");
        }
        if (proposal.revision() > 1) {
            invalidatePending(proposal.id(), proposal.revision());
        }
    }

    @Override
    public Optional<ActionProposal> findAction(ResourceId actionId, int revision) {
        return jdbcTemplate.query(
                        "SELECT p.id, p.execution_id, p.agent_instance_id, p.task_id, p.action_type, r.resource, "
                                + "r.scope, r.working_directory, r.arguments, r.network_target, r.expected_effects, "
                                + "r.classification, r.revision FROM action_proposals p JOIN action_revisions r "
                                + "ON r.action_proposal_id = p.id WHERE p.id = ? AND r.revision = ?",
                        (row, index) -> action(row), actionId.asString(), revision)
                .stream().findFirst();
    }

    @Override
    @Transactional
    public void saveApproval(Approval approval) {
        if (approval.state() == Approval.State.PENDING) {
            int inserted = jdbcTemplate.update(
                    "INSERT INTO approvals (id, action_proposal_id, action_revision, state, decided_by, decided_at, "
                            + "reason, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    approval.id().asString(), approval.actionProposalId().asString(), approval.actionRevision(),
                    approval.state().name(), nullable(approval.decidedBy()), nullable(approval.decidedAt()),
                    approval.reason(), approval.version());
            if (inserted != 1) {
                throw DomainError.conflict("La aprobacion ya existe");
            }
            return;
        }
        int updated = jdbcTemplate.update(
                "UPDATE approvals SET state = ?, decided_by = ?, decided_at = ?, reason = ?, version = ? "
                        + "WHERE id = ? AND state = 'PENDING' AND version = ?",
                approval.state().name(), nullable(approval.decidedBy()), nullable(approval.decidedAt()),
                approval.reason(),
                approval.version(), approval.id().asString(), approval.version() - 1);
        if (updated != 1) {
            throw DomainError.conflict("La aprobacion ya fue decidida");
        }
    }

    @Override
    public Optional<Approval> findApproval(ResourceId approvalId) {
        return jdbcTemplate.query(
                        "SELECT id, action_proposal_id, action_revision, state, decided_by, decided_at, "
                                + "reason, version "
                                + "FROM approvals WHERE id = ?",
                        (row, index) -> approval(row), approvalId.asString())
                .stream().findFirst();
    }

    @Override
    public List<Approval> findPendingByProject(ResourceId projectId) {
        return jdbcTemplate.query(
                        "SELECT a.id, a.action_proposal_id, a.action_revision, a.state, a.decided_by, "
                                + "a.decided_at, a.reason, a.version FROM approvals a "
                                + "JOIN action_proposals p ON p.id = a.action_proposal_id "
                                + "JOIN tasks t ON t.id = p.task_id "
                                + "WHERE t.project_id = ? AND a.state = 'PENDING' "
                                + "ORDER BY a.id",
                        (row, index) -> approval(row), projectId.asString());
    }

    @Override
    @Transactional
    public Approval decide(ResourceId approvalId, ApprovalDecision decision) {
        Approval current = findApproval(approvalId)
                .orElseThrow(() -> DomainError.notFound("Approval", approvalId));
        if (current.state() != Approval.State.PENDING || current.actionRevision() != decision.actionRevision()) {
            throw DomainError.approvalStale("La aprobacion no corresponde a una revision pendiente");
        }
        Approval updated = current.decide(decision);
        int changed = jdbcTemplate.update(
                "UPDATE approvals SET state = ?, decided_by = ?, decided_at = ?, reason = ?, version = ? "
                        + "WHERE id = ? AND state = 'PENDING' AND action_revision = ? AND version = ?",
                updated.state().name(), updated.decidedBy().asString(), updated.decidedAt().toString(),
                updated.reason(),
                updated.version(), approvalId.asString(), decision.actionRevision(), current.version());
        if (changed != 1) {
            throw DomainError.approvalStale("La aprobacion fue modificada por otra operacion");
        }
        return updated;
    }

    @Override
    @Transactional
    public void invalidatePending(ResourceId actionProposalId, int currentRevision) {
        jdbcTemplate.update(
                "UPDATE approvals SET state = 'INVALIDATED', reason = 'La accion fue revisada', "
                        + "decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), version = version + 1 "
                        + "WHERE action_proposal_id = ? "
                        + "AND state = 'PENDING' AND action_revision <> ?",
                actionProposalId.asString(), currentRevision);
    }

    @Override
    public PermissionPolicy defaultPolicy(ResourceId runtimeSettingsId, PermissionMode mode, Set<String> rules) {
        return new PermissionPolicy(runtimeSettingsId, mode, rules);
    }

    private PermissionPolicy policy(ResultSet row) throws SQLException {
        return new PermissionPolicy(ResourceId.parse(row.getString("id")),
                ResourceId.parse(row.getString("runtime_settings_id")),
                PermissionMode.valueOf(row.getString("permission_mode")),
                deserialize(row.getString("auto_approve_rules")),
                deserialize(row.getString("constitutional_prohibitions")));
    }

    private ActionProposal action(ResultSet row) throws SQLException {
        return new ActionProposal(ResourceId.parse(row.getString("id")),
                ResourceId.parse(row.getString("execution_id")),
                parseNullable(row.getString("agent_instance_id")), parseNullable(row.getString("task_id")),
                row.getString("action_type"), row.getString("resource"), row.getString("scope"),
                row.getString("working_directory"), deserializeList(row.getString("arguments")),
                row.getString("network_target"), Set.copyOf(deserializeList(row.getString("expected_effects"))),
                PermissionPolicy.ActionCategory.valueOf(row.getString("classification")), row.getInt("revision"));
    }

    private Approval approval(ResultSet row) throws SQLException {
        String decidedAt = row.getString("decided_at");
        return new Approval(ResourceId.parse(row.getString("id")),
                ResourceId.parse(row.getString("action_proposal_id")),
                row.getInt("action_revision"), Approval.State.valueOf(row.getString("state")),
                parseNullable(row.getString("decided_by")), decidedAt == null ? null : Instant.parse(decidedAt),
                row.getString("reason"), row.getLong("version"));
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("No se pudo serializar metadata de aprobacion", error);
        }
    }

    private List<String> deserializeList(String value) {
        try {
            return objectMapper.readValue(value, STRING_LIST);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("No se pudo leer metadata de aprobacion", error);
        }
    }

    private Set<String> deserialize(String value) {
        return Set.copyOf(deserializeList(value));
    }

    private static String nullable(ResourceId id) {
        return id == null ? null : id.asString();
    }

    private static String nullable(Instant value) {
        return value == null ? null : value.toString();
    }

    private static ResourceId parseNullable(String value) {
        return value == null ? null : ResourceId.parse(value);
    }
}
