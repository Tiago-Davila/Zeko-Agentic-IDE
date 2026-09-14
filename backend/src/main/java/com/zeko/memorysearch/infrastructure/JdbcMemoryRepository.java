package com.zeko.memorysearch.infrastructure;

import com.zeko.memorysearch.application.MemoryRepository;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.memorysearch.domain.MemoryScope;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcMemoryRepository implements MemoryRepository {
  private final JdbcTemplate jdbc;

  public JdbcMemoryRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void save(MemoryEntry entry) {
    jdbc.update(
        "INSERT INTO memory_entries (id, scope, project_id, owner_id, " +
        "source_path, fingerprint, index_state, sensitive) VALUES (?, ?, ?, " +
        "?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET " +
        "fingerprint=excluded.fingerprint, index_state=excluded.index_state, " +
        "sensitive=excluded.sensitive",
        entry.id().asString(), entry.scope().name(), id(entry.projectId()),
        entry.ownerId().asString(), entry.sourcePath(), entry.fingerprint(),
        entry.indexState().name(), entry.sensitive() ? 1 : 0);
  }

  @Override
  public Optional<MemoryEntry> find(ResourceId id) {
    return jdbc
        .query("SELECT * FROM memory_entries WHERE id = ?",
               (row, index) -> entry(row), id.asString())
        .stream()
        .findFirst();
  }

  @Override
  public List<MemoryEntry> findForProject(ResourceId projectId) {
    return jdbc.query(
        "SELECT * FROM memory_entries WHERE project_id = ? OR scope = 'GLOBAL'",
        (row, index) -> entry(row), projectId.asString());
  }

  private static MemoryEntry entry(java.sql.ResultSet row)
      throws java.sql.SQLException {
    String project = row.getString("project_id");
    return new MemoryEntry(
        ResourceId.parse(row.getString("id")),
        MemoryScope.valueOf(row.getString("scope")),
        project == null ? null : ResourceId.parse(project),
        ResourceId.parse(row.getString("owner_id")),
        row.getString("source_path"), row.getString("fingerprint"),
        MemoryEntry.IndexState.valueOf(row.getString("index_state")),
        row.getInt("sensitive") == 1);
  }

  private static String id(ResourceId id) {
    return id == null ? null : id.asString();
  }
}
