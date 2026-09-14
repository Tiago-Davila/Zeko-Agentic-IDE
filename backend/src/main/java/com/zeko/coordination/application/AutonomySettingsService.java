package com.zeko.coordination.application;

import com.zeko.coordination.domain.AutonomyMode;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AutonomySettingsService {

    private final JdbcTemplate jdbcTemplate;

    public AutonomySettingsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = Objects.requireNonNull(jdbcTemplate, "La base local es obligatoria");
    }

    public AutonomyMode get(ResourceId instanceId) {
        ensureRuntimeSettings(instanceId);
        return jdbcTemplate.queryForObject("SELECT autonomy_mode FROM agent_runtime_settings WHERE instance_id = ?",
                (row, index) -> AutonomyMode.valueOf(row.getString(1)), instanceId.asString());
    }

    public AutonomyMode update(ResourceId instanceId, AutonomyMode mode) {
        ensureRuntimeSettings(instanceId);
        if (mode == null) {
            throw DomainError.validation("El modo de autonomia es obligatorio");
        }
        int updated = jdbcTemplate.update("UPDATE agent_runtime_settings SET autonomy_mode = ?, version = version + 1, "
                        + "updated_at = CURRENT_TIMESTAMP WHERE instance_id = ?",
                mode.name(), instanceId.asString());
        if (updated != 1) {
            throw DomainError.conflict("La configuracion de autonomia fue modificada");
        }
        return mode;
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
