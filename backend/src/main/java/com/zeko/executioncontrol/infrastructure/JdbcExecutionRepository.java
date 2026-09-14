package com.zeko.executioncontrol.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeko.executioncontrol.application.ExecutionRepository;
import com.zeko.executioncontrol.domain.EffectRecord;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.ExecutionSnapshot;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.sharedkernel.domain.ResourceId;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@org.springframework.stereotype.Repository
public class JdbcExecutionRepository implements ExecutionRepository {
  private static final TypeReference<Map<String, String>> CONTEXT =
      new TypeReference<>() {};
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public JdbcExecutionRepository(JdbcTemplate jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  @Override
  public void saveTask(Task task) {
    jdbc.update("INSERT INTO tasks (id, project_id, repository_id, "
                    + "agent_instance_id, instruction_id, title, state, "
                    + "blocked_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON "
                    + "CONFLICT(id) DO UPDATE SET state = "
                    + "excluded.state, blocked_reason = "
                    + "excluded.blocked_reason, version = tasks.version + 1, "
                    + "updated_at = CURRENT_TIMESTAMP",
                task.id().asString(), task.projectId().asString(),
                task.repositoryId().asString(),
                task.agentInstanceId().asString(),
                task.instructionId().asString(), task.title(),
                task.state().name(), task.blockedReason());
  }

  @Override
  public Optional<Task> findTask(ResourceId taskId) {
    return jdbc
        .query("SELECT id, project_id, repository_id, agent_instance_id, "
                   + "instruction_id, title, state, "
                   + "blocked_reason FROM tasks WHERE id = ?",
               (row, number) -> task(row), taskId.asString())
        .stream()
        .findFirst();
  }

  @Override
  @Transactional
  public void saveExecution(Execution execution) {
    jdbc.update(
        "INSERT INTO executions (id, task_id, attempt, state, retry_of, "
            + "known_state, cancellation_requested) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
            + "state = excluded.state, "
            + "known_state = excluded.known_state, cancellation_requested = "
            + "excluded.cancellation_requested, "
            +
            "version = executions.version + 1, updated_at = CURRENT_TIMESTAMP",
        execution.id().asString(), execution.taskId().asString(),
        execution.attempt(), execution.state().name(), id(execution.retryOf()),
        execution.knownState(), execution.cancellationRequested() ? 1 : 0);
    ExecutionSnapshot snapshot = execution.snapshot();
    jdbc.update("INSERT OR IGNORE INTO execution_snapshots (execution_id, "
                    + "template_id, template_version, "
                    + "agent_identity, context) VALUES (?, ?, ?, ?, ?)",
                execution.id().asString(), snapshot.templateId().asString(),
                snapshot.templateVersion(), snapshot.agentIdentity(),
                write(snapshot.context()));
  }

  @Override
  public Optional<Execution> findExecution(ResourceId executionId) {
    return jdbc
        .query("SELECT e.id, e.task_id, e.attempt, e.state, e.retry_of, "
                   + "e.known_state, "
                   + "e.cancellation_requested, s.template_id, "
                   + "s.template_version, s.agent_identity, s.context "
                   + "FROM executions e JOIN execution_snapshots s ON "
                   + "s.execution_id = e.id WHERE e.id = ?",
               (row, number) -> execution(row), executionId.asString())
        .stream()
        .findFirst();
  }

  @Override
  public List<Execution> findExecutions(ResourceId taskId) {
    return jdbc.query("SELECT e.id, e.task_id, e.attempt, e.state, "
                          + "e.retry_of, e.known_state, "
                          + "e.cancellation_requested, s.template_id, "
                          + "s.template_version, s.agent_identity, s.context "
                          + "FROM executions e JOIN execution_snapshots s ON "
                          + "s.execution_id = e.id WHERE e.task_id = ? "
                          + "ORDER BY e.attempt",
                      (row, number) -> execution(row), taskId.asString());
  }

  @Override
  public List<Execution> findAllExecutions() {
    return jdbc.query("SELECT e.id, e.task_id, e.attempt, e.state, "
                          + "e.retry_of, e.known_state, "
                          + "e.cancellation_requested, s.template_id, "
                          + "s.template_version, s.agent_identity, s.context "
                          + "FROM executions e JOIN execution_snapshots s ON "
                          + "s.execution_id = e.id ORDER BY e.started_at DESC",
                      (row, number) -> execution(row));
  }

  @Override
  public void appendEffect(EffectRecord effect) {
    jdbc.update("INSERT INTO effect_records (id, execution_id, sequence, "
                    + "effect_type, resource, confirmed, safe_detail) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?)",
                effect.id().asString(), effect.executionId().asString(),
                effect.sequence(), effect.type(), effect.resource(),
                effect.confirmed() ? 1 : 0, effect.safeDetail());
  }

  @Override
  public List<EffectRecord> effects(ResourceId executionId) {
    return jdbc.query(
        "SELECT id, execution_id, sequence, effect_type, resource, "
            + "confirmed, safe_detail "
            + "FROM effect_records WHERE execution_id = ? ORDER BY sequence",
        (row, number) -> effect(row), executionId.asString());
  }

  private Task task(ResultSet row) throws SQLException {
    return new Task(ResourceId.parse(row.getString("id")),
                    ResourceId.parse(row.getString("project_id")),
                    ResourceId.parse(row.getString("repository_id")),
                    ResourceId.parse(row.getString("agent_instance_id")),
                    ResourceId.parse(row.getString("instruction_id")),
                    row.getString("title"),
                    Task.State.valueOf(row.getString("state")),
                    row.getString("blocked_reason"));
  }

  private Execution execution(ResultSet row) throws SQLException {
    ResourceId executionId = ResourceId.parse(row.getString("id"));
    ExecutionSnapshot snapshot = new ExecutionSnapshot(
        ResourceId.parse(row.getString("template_id")),
        row.getInt("template_version"), row.getString("agent_identity"),
        read(row.getString("context")));
    return new Execution(
        executionId, ResourceId.parse(row.getString("task_id")),
        row.getInt("attempt"), Execution.State.valueOf(row.getString("state")),
        snapshot, nullable(row.getString("retry_of")),
        row.getString("known_state"), row.getInt("cancellation_requested") == 1,
        effects(executionId));
  }

  private EffectRecord effect(ResultSet row) throws SQLException {
    return new EffectRecord(
        ResourceId.parse(row.getString("id")),
        ResourceId.parse(row.getString("execution_id")), row.getInt("sequence"),
        row.getString("effect_type"), row.getString("resource"),
        row.getInt("confirmed") == 1, row.getString("safe_detail"));
  }

  private String write(Map<String, String> value) {
    try {
      return json.writeValueAsString(value);
    } catch (JsonProcessingException error) {
      throw new IllegalStateException("No se pudo serializar snapshot", error);
    }
  }

  private Map<String, String> read(String value) {
    try {
      return json.readValue(value, CONTEXT);
    } catch (JsonProcessingException error) {
      throw new IllegalStateException("No se pudo leer snapshot", error);
    }
  }

  private static String id(ResourceId value) {
    return value == null ? null : value.asString();
  }
  private static ResourceId nullable(String value) {
    return value == null ? null : ResourceId.parse(value);
  }
}
