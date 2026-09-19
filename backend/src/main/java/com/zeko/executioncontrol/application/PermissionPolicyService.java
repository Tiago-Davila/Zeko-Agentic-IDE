package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.PermissionMode;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class PermissionPolicyService {

    private final ApprovalRepository approvals;
    private final JdbcTemplate jdbcTemplate;

    public PermissionPolicyService(ApprovalRepository approvals, JdbcTemplate jdbcTemplate) {
        this.approvals = Objects.requireNonNull(approvals, "El repositorio de aprobaciones es obligatorio");
        this.jdbcTemplate = Objects.requireNonNull(jdbcTemplate, "La base local es obligatoria");
    }

    public PermissionPolicy get(ResourceId instanceId) {
        ensureRuntimeSettings(instanceId);
        return approvals.findPolicy(instanceId).orElseGet(() -> {
            PermissionPolicy policy = approvals.defaultPolicy(instanceId, PermissionMode.ASK_APPROVAL, Set.of());
            approvals.savePolicy(policy);
            return policy;
        });
    }

    public PermissionPolicy update(ResourceId instanceId, PermissionMode mode, Set<String> rules) {
        ensureRuntimeSettings(instanceId);
        if (mode == null) {
            throw DomainError.validation("El modo de permiso es obligatorio");
        }
        PermissionPolicy policy = new PermissionPolicy(instanceId, mode, rules);
        approvals.savePolicy(policy);
        jdbcTemplate.update("UPDATE agent_runtime_settings SET permission_mode = ?, version = version + 1, "
                        + "updated_at = CURRENT_TIMESTAMP WHERE instance_id = ?",
                mode.name(), instanceId.asString());
        return policy;
    }

    private void ensureRuntimeSettings(ResourceId instanceId) {
        int exists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM agent_instances WHERE id = ?", Integer.class, instanceId.asString());
        if (exists == 0) {
            throw DomainError.notFound("AgentInstance", instanceId);
        }
        jdbcTemplate.update("INSERT OR IGNORE INTO agent_runtime_settings (instance_id) VALUES (?)",
                instanceId.asString());
    }
}
