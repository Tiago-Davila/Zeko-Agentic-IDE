package com.zeko.agentdesign.infrastructure;

import com.zeko.agentdesign.application.SkillRepository;
import com.zeko.agentdesign.domain.AgentSkillBinding;
import com.zeko.agentdesign.domain.SkillDefinition;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;

@org.springframework.stereotype.Repository
public class JdbcSkillRepository implements SkillRepository {
    private final JdbcTemplate jdbcTemplate;

    public JdbcSkillRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void save(SkillDefinition skill) {
        jdbcTemplate.update(
                "INSERT INTO skills (id, project_id, name, skill_path, fingerprint, scope) "
                        + "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
                        + "name = excluded.name, skill_path = excluded.skill_path, "
                        + "fingerprint = excluded.fingerprint, scope = excluded.scope, updated_at = CURRENT_TIMESTAMP",
                skill.id().asString(), skill.projectId().asString(), skill.name(), skill.skillPath().toString(),
                skill.fingerprint(), skill.scope().name());
    }

    @Override
    public Optional<SkillDefinition> findById(ResourceId skillId) {
        return jdbcTemplate.query("SELECT id, project_id, name, skill_path, fingerprint, scope FROM skills "
                        + "WHERE id = ?", (row, index) -> skill(row.getString("id"), row.getString("project_id"),
                                row.getString("name"), row.getString("skill_path"), row.getString("fingerprint"),
                                row.getString("scope")), skillId.asString())
                .stream().findFirst();
    }

    @Override
    public List<SkillDefinition> findByProjectId(ResourceId projectId) {
        return jdbcTemplate.query("SELECT id, project_id, name, skill_path, fingerprint, scope FROM skills "
                        + "WHERE project_id = ? ORDER BY created_at, id",
                (row, index) -> skill(row.getString("id"), row.getString("project_id"), row.getString("name"),
                        row.getString("skill_path"), row.getString("fingerprint"), row.getString("scope")),
                projectId.asString());
    }

    @Override
    public void saveBinding(AgentSkillBinding binding) {
        jdbcTemplate.update("INSERT INTO agent_skill_bindings (id, instance_id, skill_id, state) "
                        + "VALUES (?, ?, ?, ?) "
                        + "ON CONFLICT(instance_id, skill_id) DO UPDATE SET state = excluded.state",
                binding.id().asString(), binding.instanceId().asString(), binding.skillId().asString(),
                binding.state().name());
    }

    @Override
    public List<AgentSkillBinding> findBindingsByInstanceId(ResourceId instanceId) {
        return jdbcTemplate.query("SELECT id, instance_id, skill_id, state FROM agent_skill_bindings "
                        + "WHERE instance_id = ? "
                        + "ORDER BY created_at, id",
                (row, index) -> new AgentSkillBinding(ResourceId.parse(row.getString("id")),
                        ResourceId.parse(row.getString("instance_id")), ResourceId.parse(row.getString("skill_id")),
                        AgentSkillBinding.State.valueOf(row.getString("state"))), instanceId.asString());
    }

    private static SkillDefinition skill(
            String id, String projectId, String name, String path, String fingerprint, String scope) {
        return new SkillDefinition(ResourceId.parse(id), ResourceId.parse(projectId), name, Path.of(path), fingerprint,
                SkillDefinition.Scope.valueOf(scope));
    }
}
