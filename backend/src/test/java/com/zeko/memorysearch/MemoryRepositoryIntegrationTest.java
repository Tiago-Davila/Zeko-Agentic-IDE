package com.zeko.memorysearch;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.memorysearch.application.MemoryRepository;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.memorysearch.domain.MemoryScope;
import com.zeko.memorysearch.infrastructure.JdbcMemoryRepository;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class MemoryRepositoryIntegrationTest {

  @TempDir
  static Path localDataDir;

  @Autowired
  private MemoryRepository repository;

  @Autowired
  private JdbcTemplate jdbc;

  @DynamicPropertySource
  static void localDatabase(DynamicPropertyRegistry registry) {
    registry.add("zeko.datasource.path",
        () -> localDataDir.resolve("memory-repository.db").toString());
  }

  @Test
  void reconstructsEntriesAndKeepsProjectScopeBoundaries() {
    ResourceId projectA = project("a");
    ResourceId projectB = project("b");
    MemoryEntry projectEntry = entry(MemoryScope.PROJECT, projectA, projectA,
                                     MemoryEntry.IndexState.CURRENT, false);
    MemoryEntry otherProject = entry(MemoryScope.PROJECT, projectB, projectB,
                                     MemoryEntry.IndexState.CURRENT, false);
    MemoryEntry global = entry(MemoryScope.GLOBAL, null, ResourceId.newId(),
                               MemoryEntry.IndexState.CURRENT, false);
    MemoryEntry stale = entry(MemoryScope.PROJECT, projectA, projectA,
                              MemoryEntry.IndexState.STALE, false);
    MemoryEntry sensitive = entry(MemoryScope.PROJECT, projectA, projectA,
                                  MemoryEntry.IndexState.CURRENT, true);

    List.of(projectEntry, otherProject, global, stale, sensitive)
        .forEach(repository::save);

    MemoryRepository reopened = new JdbcMemoryRepository(jdbc);

    assertThat(reopened.find(projectEntry.id())).contains(projectEntry);
    assertThat(reopened.findForProject(projectA))
        .extracting(MemoryEntry::id)
        .containsExactlyInAnyOrder(projectEntry.id(), global.id(), stale.id(),
                                   sensitive.id())
        .doesNotContain(otherProject.id());
  }

  private ResourceId project(String suffix) {
    ResourceId id = ResourceId.newId();
    jdbc.update("INSERT INTO projects (id, name, root_path) VALUES (?, ?, ?)",
        id.asString(), "Memoria " + suffix,
        localDataDir.resolve("project-" + suffix).toString());
    return id;
  }

  private static MemoryEntry entry(MemoryScope scope, ResourceId projectId,
                                   ResourceId ownerId,
                                   MemoryEntry.IndexState state,
                                   boolean sensitive) {
    return new MemoryEntry(ResourceId.newId(), scope, projectId, ownerId,
                           Path.of("notes.md").toAbsolutePath().toString(),
                           UUID.randomUUID().toString(), state, sensitive);
  }
}
