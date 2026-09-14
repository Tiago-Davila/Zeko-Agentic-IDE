package com.zeko.coordination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.coordination.application.FollowUpRepository;
import com.zeko.coordination.domain.FollowUpProposal;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class FollowUpRepositoryIntegrationTest {
  @TempDir static Path localDataDir;
  @Autowired private FollowUpRepository proposals;
  @Autowired private JdbcTemplate jdbcTemplate;
  @DynamicPropertySource
  static void database(DynamicPropertyRegistry registry) {
    registry.add("zeko.datasource.path",
                 () -> localDataDir.resolve("follow-ups.db").toString());
  }
  @Test
  void recordsOneDecisionForAnExistingProposal() {
    ResourceId instructionId = parentInstruction();
    String agentId = jdbcTemplate.queryForObject(
        "SELECT id FROM agent_instances LIMIT 1", String.class);
    FollowUpProposal pending =
        proposal(instructionId, ResourceId.parse(agentId),
                 FollowUpProposal.State.PENDING_CONFIRMATION);
    proposals.save(pending);
    FollowUpProposal accepted = pending.decide(true, true);
    proposals.save(accepted);
    assertThat(proposals.findById(pending.id())).contains(accepted);
    assertThatThrownBy(() -> proposals.save(accepted))
        .isInstanceOf(DomainError.class);
  }
  private ResourceId parentInstruction() {
    String projectId = ResourceId.newId().asString();
    String conversationId = ResourceId.newId().asString();
    String instructionId = ResourceId.newId().asString();
    jdbcTemplate.update(
        "INSERT INTO projects (id, name, root_path) VALUES (?, ?, ?)",
        projectId, "Zeko", localDataDir.toString());
    jdbcTemplate.update("INSERT INTO conversations (id, project_id, " +
                        "recipient_type, recipient_id) VALUES (?, ?, 'PM', ?)",
                        conversationId, projectId,
                        ResourceId.newId().asString());
    jdbcTemplate.update(
        "INSERT INTO instructions (id, conversation_id, origin, content, " +
        "precedence, created_at) VALUES (?, ?, 'USER', 'seguir', 'USER', ?)",
        instructionId, conversationId, Instant.now().toString());
    jdbcTemplate.update("INSERT INTO agent_templates (id, project_id, name, " +
                        "version) VALUES (?, ?, ?, 1)",
                        ResourceId.newId().asString(), projectId, "Agent");
    String templateId = jdbcTemplate.queryForObject(
        "SELECT id FROM agent_templates WHERE project_id = ?", String.class,
        projectId);
    jdbcTemplate.update(
        "INSERT INTO template_versions (id, template_id, number, " +
        "configuration, created_at) VALUES (?, ?, 1, '{}', ?)",
        ResourceId.newId().asString(), templateId, Instant.now().toString());
    jdbcTemplate.update(
        "INSERT INTO agent_instances (id, project_id, template_id, " +
        "selected_template_version, identity, context, state) VALUES (?, ?, " +
        "?, 1, 'agent', '{}', 'READY')",
        ResourceId.newId().asString(), projectId, templateId);
    return ResourceId.parse(instructionId);
  }
  private static FollowUpProposal proposal(ResourceId instructionId,
                                           ResourceId agentId,
                                           FollowUpProposal.State state) {
    return new FollowUpProposal(ResourceId.newId(), instructionId, agentId,
                                "seguir", state,
                                Instant.parse("2026-09-14T19:00:00Z"));
  }
}
