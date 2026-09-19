package com.zeko.executioncontrol.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeko.executioncontrol.application.WorktreeRepository;
import com.zeko.executioncontrol.domain.ConflictRecord;
import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@org.springframework.stereotype.Repository
public class JdbcWorktreeRepository implements WorktreeRepository {
  private static final TypeReference<List<String>> RESOURCES =
      new TypeReference<>() {};
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public JdbcWorktreeRepository(JdbcTemplate jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  @Override
  @Transactional
  public Worktree reserve(Worktree worktree) {
    try {
      jdbc.update("INSERT INTO worktrees (id, repository_id, task_id, "
                      + "logical_path, physical_path, state, "
                      + "owner_execution_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  worktree.id().asString(), worktree.repositoryId().asString(),
                  worktree.taskId().asString(), worktree.logicalPath(),
                  worktree.physicalPath(), worktree.state().name(),
                  id(worktree.ownerExecutionId()));
      return worktree;
    } catch (org.springframework.dao.DataAccessException conflict) {
      if (!(conflict instanceof org.springframework.dao.DataIntegrityViolationException)
          && (conflict.getMessage() == null
              || !conflict.getMessage().contains("SQLITE_CONSTRAINT"))) {
        throw conflict;
      }
      throw DomainError.conflict(
          "El worktree ya tiene un escritor o una task reservada");
    }
  }

  @Override
  public Optional<Worktree> findByTask(ResourceId taskId) {
    return jdbc
        .query("SELECT id, repository_id, task_id, logical_path, "
                   + "physical_path, state, owner_execution_id "
                   + "FROM worktrees WHERE task_id = ?",
               (row, number) -> worktree(row), taskId.asString())
        .stream()
        .findFirst();
  }

  @Override
  public Optional<Worktree> findByPhysicalPath(String physicalPath) {
    String normalized = java.nio.file.Path.of(physicalPath)
                            .toAbsolutePath()
                            .normalize()
                            .toString();
    return jdbc
        .query("SELECT id, repository_id, task_id, logical_path, "
                   + "physical_path, state, owner_execution_id "
                   + "FROM worktrees WHERE physical_path = ? AND state <> "
                   + "'RELEASED'",
               (row, number) -> worktree(row), normalized)
        .stream()
        .findFirst();
  }

  @Override
  public void save(Worktree worktree) {
    int updated =
        jdbc.update("UPDATE worktrees SET state = ?, owner_execution_id = ?, "
                        + "version = version + 1, "
                        + "updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    worktree.state().name(), id(worktree.ownerExecutionId()),
                    worktree.id().asString());
    if (updated != 1) {
      throw DomainError.notFound("Worktree", worktree.id());
    }
  }

  @Override
  public void saveConflict(ConflictRecord conflict) {
    jdbc.update("INSERT INTO conflict_records (id, task_id, conflict_type, "
                    + "resources, state, detected_at, resolution) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO "
                    + "UPDATE SET state = excluded.state, resolution = "
                    + "excluded.resolution",
                conflict.id().asString(), conflict.taskId().asString(),
                conflict.type().name(), write(conflict.resources()),
                conflict.state().name(), conflict.detectedAt().toString(),
                conflict.resolution());
  }

  @Override
  public Optional<ConflictRecord> findConflict(ResourceId taskId) {
    return jdbc
        .query("SELECT id, task_id, conflict_type, resources, state, "
                   + "detected_at, resolution "
                   + "FROM conflict_records WHERE task_id = ? ORDER BY "
                   + "detected_at DESC LIMIT 1",
               (row, number) -> conflict(row), taskId.asString())
        .stream()
        .findFirst();
  }

  private Worktree worktree(ResultSet row) throws SQLException {
    return new Worktree(ResourceId.parse(row.getString("id")),
                        ResourceId.parse(row.getString("repository_id")),
                        ResourceId.parse(row.getString("task_id")),
                        row.getString("logical_path"),
                        row.getString("physical_path"),
                        Worktree.State.valueOf(row.getString("state")),
                        nullable(row.getString("owner_execution_id")));
  }

  private ConflictRecord conflict(ResultSet row) throws SQLException {
    return new ConflictRecord(
        ResourceId.parse(row.getString("id")),
        ResourceId.parse(row.getString("task_id")),
        ConflictRecord.Type.valueOf(row.getString("conflict_type")),
        read(row.getString("resources")),
        ConflictRecord.State.valueOf(row.getString("state")),
        Instant.parse(row.getString("detected_at")),
        row.getString("resolution"));
  }

  private String write(List<String> values) {
    try {
      return json.writeValueAsString(values);
    } catch (JsonProcessingException error) {
      throw new IllegalStateException("No se pudo serializar conflicto", error);
    }
  }

  private List<String> read(String value) {
    try {
      return json.readValue(value, RESOURCES);
    } catch (JsonProcessingException error) {
      throw new IllegalStateException("No se pudo leer conflicto", error);
    }
  }

  private static String id(ResourceId value) {
    return value == null ? null : value.asString();
  }
  private static ResourceId nullable(String value) {
    return value == null ? null : ResourceId.parse(value);
  }
}
