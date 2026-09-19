package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.application.ExecutionRepository;
import com.zeko.executioncontrol.domain.Execution;
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
class RuntimeSnapshotIntegrationTest {

  @TempDir
  static Path localDataDir;

  @Autowired
  private ExecutionRepository executions;

  @Autowired
  private JdbcTemplate jdbc;

  @DynamicPropertySource
  static void localDatabase(DynamicPropertyRegistry registry) {
    registry.add("zeko.datasource.path", () -> localDataDir.resolve("runtime-snapshot.db").toString());
    registry.add("zeko.datasource.busy-timeout", () -> "5s");
    registry.add("zeko.datasource.max-pool-size", () -> "2");
    registry.add("zeko.datasource.migration-lock-timeout", () -> "30s");
  }

  @Test
  void filtraEjecucionesYTasksPorProyectoConElSchemaVigente() {
    Graph first = graph();
    Graph second = graph();

    assertThat(executions.findAllExecutions(first.project())).extracting(execution -> execution.id().asString())
        .containsExactly(first.execution().asString());
    assertThat(executions.findAllExecutions(second.project())).extracting(execution -> execution.id().asString())
        .containsExactly(second.execution().asString());
    assertThat(executions.findTasks(first.project())).extracting(task -> task.id().asString())
        .containsExactly(first.task().asString());
  }

  @Test
  void consultaGlobalOrdenaPorCreatedAtQueExiste() {
    Graph graph = graph();

    assertThat(executions.findAllExecutions()).extracting(Execution::id)
        .contains(graph.execution());
  }

  private Graph graph() {
    String project = id();
    String repository = id();
    String template = id();
    String version = id();
    String instance = id();
    String conversation = id();
    String instruction = id();
    String task = id();
    String execution = id();
    jdbc.update("INSERT INTO projects (id, name, root_path) VALUES (?, ?, ?)", project, project, "/tmp/" + project);
    jdbc.update("INSERT INTO repositories (id, project_id, normalized_path, access_state) VALUES (?, ?, ?, ?)",
        repository, project, "/tmp/" + repository, "AVAILABLE");
    jdbc.update("INSERT INTO agent_templates (id, project_id, name, version) VALUES (?, ?, ?, 1)",
        template, project, template);
    jdbc.update("INSERT INTO template_versions (id, template_id, number, configuration, created_at) "
            + "VALUES (?, ?, 1, '{}', CURRENT_TIMESTAMP)",
        version, template);
    jdbc.update("INSERT INTO agent_instances (id, project_id, template_id, selected_template_version, "
            + "identity, context, state) VALUES (?, ?, ?, 1, ?, '{}', 'READY')",
        instance, project, template, instance);
    jdbc.update("INSERT INTO conversations (id, project_id, recipient_type, recipient_id) VALUES (?, ?, 'PM', ?)",
        conversation, project, instance);
    jdbc.update("INSERT INTO instructions (id, conversation_id, origin, content, precedence, created_at) "
            + "VALUES (?, ?, 'USER', 'run', 'USER', CURRENT_TIMESTAMP)",
        instruction, conversation);
    jdbc.update("INSERT INTO tasks (id, project_id, repository_id, agent_instance_id, instruction_id, title, "
            + "state) VALUES (?, ?, ?, ?, ?, ?, 'READY')",
        task, project, repository, instance, instruction, task);
    jdbc.update("INSERT INTO executions (id, task_id, attempt, state, known_state) "
            + "VALUES (?, ?, 1, 'PENDING', 'PENDING')",
        execution, task);
    jdbc.update("INSERT INTO execution_snapshots (execution_id, template_id, template_version, "
            + "agent_identity, context) VALUES (?, ?, 1, ?, '{}')",
        execution, template, instance);
    return new Graph(ResourceId.parse(project), ResourceId.parse(task), ResourceId.parse(execution));
  }

  private static String id() {
    return UUID.randomUUID().toString();
  }

  private record Graph(ResourceId project, ResourceId task, ResourceId execution) {
  }
}
