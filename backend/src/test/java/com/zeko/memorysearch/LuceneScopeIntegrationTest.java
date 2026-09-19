package com.zeko.memorysearch;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.memorysearch.application.ContextIndex;
import com.zeko.memorysearch.application.MemoryRepository;
import com.zeko.memorysearch.application.MemorySearchService;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.memorysearch.domain.MemoryScope;
import com.zeko.memorysearch.infrastructure.LuceneContextIndex;
import com.zeko.sharedkernel.domain.ResourceId;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LuceneScopeIntegrationTest {

  @TempDir
  Path localRoot;

  @Test
  void searchesOnlyCurrentEntriesFromTheSelectedProjectAndOwners()
      throws IOException {
    ResourceId projectA = ResourceId.newId();
    ResourceId projectB = ResourceId.newId();
    ResourceId agentA = ResourceId.newId();
    MemoryEntry projectEntry = source(projectA, projectA, "project-a.md",
                                      "arquitectura del proyecto A");
    MemoryEntry otherProject = source(projectB, projectB, "project-b.md",
                                      "arquitectura del proyecto B");
    MemoryEntry global = source(null, ResourceId.newId(), "global.md",
                                "arquitectura global compartida");
    MemoryEntry agent = source(MemoryScope.AGENT, projectA, agentA,
                               "agent-a.md", "contexto privado del agente");
    MemoryEntry stale = source(projectA, projectA, "stale.md",
                               "arquitectura obsoleta", MemoryEntry.IndexState.STALE,
                               false);
    MemoryEntry sensitive = source(projectA, projectA, "secret.md",
                                   "arquitectura secreta", MemoryEntry.IndexState.CURRENT,
                                   true);
    InMemoryMemoryRepository entries = new InMemoryMemoryRepository();
    LuceneContextIndex index = new LuceneContextIndex(localRoot.resolve("index"));
    List.of(projectEntry, otherProject, global, agent, stale, sensitive)
        .forEach(entry -> entries.save(entry));
    index(index, projectEntry, otherProject, global, agent, stale, sensitive);

    MemorySearchService search = new MemorySearchService(entries, index);

    assertThat(search.search(projectA, List.of(agentA), "arquitectura"))
        .extracting(ContextIndex.Result::sourceId)
        .containsExactlyInAnyOrder(projectEntry.id(), global.id())
        .doesNotContain(otherProject.id(), stale.id(), sensitive.id());
    assertThat(search.search(projectA, List.of(agentA), "privado"))
        .extracting(ContextIndex.Result::sourceId)
        .containsExactly(agent.id());
    assertThat(search.search(projectA, List.of(ResourceId.newId()), "privado"))
        .isEmpty();
  }

  @Test
  void rebuildsFromTemporarySourceContentAndSurvivesAnIndexReopen()
      throws IOException {
    ResourceId projectId = ResourceId.newId();
    MemoryEntry entry = source(projectId, projectId, "rebuild.md",
                               "reconstruccion persistente");
    Path indexRoot = localRoot.resolve("rebuild-index");
    LuceneContextIndex index = new LuceneContextIndex(indexRoot);
    index.rebuild(List.of(new ContextIndex.IndexedEntry(
        entry, Files.readString(Path.of(entry.sourcePath())))));

    assertThat(new LuceneContextIndex(indexRoot)
        .search(projectId, projectId, "reconstruccion"))
        .extracting(ContextIndex.Result::sourceId)
        .containsExactly(entry.id());
  }

  private void index(LuceneContextIndex index, MemoryEntry... entries)
      throws IOException {
    for (MemoryEntry entry : entries) {
      index.index(entry, Files.readString(Path.of(entry.sourcePath())));
    }
  }

  private MemoryEntry source(ResourceId projectId, ResourceId ownerId,
                             String fileName, String content) throws IOException {
    return source(projectId == null ? MemoryScope.GLOBAL : MemoryScope.PROJECT,
                  projectId, ownerId, fileName, content,
                  MemoryEntry.IndexState.CURRENT, false);
  }

  private MemoryEntry source(MemoryScope scope, ResourceId projectId,
                             ResourceId ownerId, String fileName, String content)
      throws IOException {
    return source(scope, projectId, ownerId, fileName, content,
                  MemoryEntry.IndexState.CURRENT, false);
  }

  private MemoryEntry source(ResourceId projectId, ResourceId ownerId,
                             String fileName, String content,
                             MemoryEntry.IndexState state, boolean sensitive)
      throws IOException {
    return source(projectId == null ? MemoryScope.GLOBAL : MemoryScope.PROJECT,
                  projectId, ownerId, fileName, content, state, sensitive);
  }

  private MemoryEntry source(MemoryScope scope, ResourceId projectId,
                             ResourceId ownerId, String fileName, String content,
                             MemoryEntry.IndexState state, boolean sensitive)
      throws IOException {
    Path path = localRoot.resolve(fileName);
    Files.writeString(path, content);
    return new MemoryEntry(ResourceId.newId(), scope, projectId, ownerId,
                           path.toString(), "fingerprint", state, sensitive);
  }

  private static final class InMemoryMemoryRepository
      implements MemoryRepository {
    private final Map<ResourceId, MemoryEntry> entries = new HashMap<>();

    @Override
    public void save(MemoryEntry entry) {
      entries.put(entry.id(), entry);
    }

    @Override
    public Optional<MemoryEntry> find(ResourceId id) {
      return Optional.ofNullable(entries.get(id));
    }

    @Override
    public List<MemoryEntry> findForProject(ResourceId projectId) {
      return entries.values().stream()
          .filter(entry -> entry.scope() == MemoryScope.GLOBAL
              || projectId.equals(entry.projectId()))
          .toList();
    }
  }
}
