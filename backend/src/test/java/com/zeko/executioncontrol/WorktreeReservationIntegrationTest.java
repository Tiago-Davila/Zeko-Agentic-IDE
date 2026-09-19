package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.executioncontrol.application.WorktreeRepository;
import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class WorktreeReservationIntegrationTest {

  @TempDir
  static Path localDataDir;

  @Autowired
  private WorktreeRepository worktrees;

  @Autowired
  private JdbcTemplate jdbc;

  @DynamicPropertySource
  static void localDatabase(DynamicPropertyRegistry registry) {
    registry.add("zeko.datasource.path", () -> localDataDir.resolve("worktrees.db").toString());
  }

  @Test
  void rejectsASecondWriterUntilTheFirstWorktreeIsReleased() {
    Graph graph = graph();
    String sharedPath = localDataDir.resolve("shared-worktree").toString();
    Worktree first = worktree(graph.repository(), graph.firstTask(), sharedPath);
    Worktree second = worktree(graph.repository(), graph.secondTask(), sharedPath);

    assertThat(worktrees.reserve(first)).isEqualTo(first);
    assertThatThrownBy(() -> worktrees.reserve(second))
        .isInstanceOfSatisfying(DomainError.class, error ->
            assertThat(error.code()).isEqualTo(DomainError.Code.CONFLICT));
    assertThat(worktrees.findByPhysicalPath(sharedPath)).contains(first);

    worktrees.save(first.release());

    assertThat(worktrees.findByPhysicalPath(sharedPath)).isEmpty();
    assertThat(worktrees.reserve(second)).isEqualTo(second);
  }

  private Graph graph() {
    String project = id();
    String repository = id();
    String template = id();
    String templateVersion = id();
    String instance = id();
    String conversation = id();
    String instruction = id();
    String firstTask = id();
    String secondTask = id();
    jdbc.update("INSERT INTO projects (id, name, root_path) VALUES (?, ?, ?)",
        project, project, localDataDir.toString());
    jdbc.update("INSERT INTO repositories (id, project_id, normalized_path, git_root, access_state) "
            + "VALUES (?, ?, ?, ?, 'AVAILABLE')",
        repository, project, localDataDir.toString(), localDataDir.toString());
    jdbc.update("INSERT INTO agent_templates (id, project_id, name, version) VALUES (?, ?, ?, 1)",
        template, project, template);
    jdbc.update("INSERT INTO template_versions (id, template_id, number, configuration, created_at) "
            + "VALUES (?, ?, 1, '{}', CURRENT_TIMESTAMP)",
        templateVersion, template);
    jdbc.update("INSERT INTO agent_instances (id, project_id, template_id, selected_template_version, "
            + "identity, context, state) VALUES (?, ?, ?, 1, ?, '{}', 'READY')",
        instance, project, template, instance);
    jdbc.update("INSERT INTO conversations (id, project_id, recipient_type, recipient_id) "
            + "VALUES (?, ?, 'PM', ?)", conversation, project, instance);
    jdbc.update("INSERT INTO instructions (id, conversation_id, origin, content, precedence, created_at) "
            + "VALUES (?, ?, 'USER', 'reserve worktree', 'USER', CURRENT_TIMESTAMP)",
        instruction, conversation);
    jdbc.update("INSERT INTO tasks (id, project_id, repository_id, agent_instance_id, instruction_id, "
            + "title, state) VALUES (?, ?, ?, ?, ?, ?, 'READY')",
        firstTask, project, repository, instance, instruction, "first");
    jdbc.update("INSERT INTO tasks (id, project_id, repository_id, agent_instance_id, instruction_id, "
            + "title, state) VALUES (?, ?, ?, ?, ?, ?, 'READY')",
        secondTask, project, repository, instance, instruction, "second");
    return new Graph(ResourceId.parse(repository), ResourceId.parse(firstTask),
        ResourceId.parse(secondTask));
  }

  private static Worktree worktree(ResourceId repositoryId, ResourceId taskId, String path) {
    return new Worktree(ResourceId.newId(), repositoryId, taskId, path, path,
        Worktree.State.RESERVED, null);
  }

  private static String id() {
    return UUID.randomUUID().toString();
  }

  private record Graph(ResourceId repository, ResourceId firstTask, ResourceId secondTask) {
  }
}
