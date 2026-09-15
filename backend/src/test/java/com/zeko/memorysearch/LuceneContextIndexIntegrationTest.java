package com.zeko.memorysearch;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.memorysearch.application.ContextIndex;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.memorysearch.domain.MemoryScope;
import com.zeko.memorysearch.infrastructure.LuceneContextIndex;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LuceneContextIndexIntegrationTest {

  @TempDir
  Path indexRoot;

  @Test
  void persistsScopedDocumentsWhenTheLocalIndexIsReopened() {
    ResourceId projectId = ResourceId.newId();
    ResourceId ownerId = ResourceId.newId();
    MemoryEntry projectEntry = entry(MemoryScope.PROJECT, projectId, ownerId,
                                     MemoryEntry.IndexState.CURRENT, false);
    MemoryEntry otherProject = entry(MemoryScope.PROJECT, ResourceId.newId(),
                                     ownerId, MemoryEntry.IndexState.CURRENT, false);
    MemoryEntry globalEntry = entry(MemoryScope.GLOBAL, null, ResourceId.newId(),
                                    MemoryEntry.IndexState.CURRENT, false);
    LuceneContextIndex writer = new LuceneContextIndex(indexRoot);
    writer.index(projectEntry, "contexto de proyecto compartido");
    writer.index(otherProject, "contexto de otro proyecto");
    writer.index(globalEntry, "contexto global compartido");

    ContextIndex reopened = new LuceneContextIndex(indexRoot);

    assertThat(reopened.search(projectId, ownerId, "contexto"))
        .extracting(ContextIndex.Result::sourceId)
        .containsExactlyInAnyOrder(projectEntry.id(), globalEntry.id())
        .doesNotContain(otherProject.id());
  }

  @Test
  void excludesSensitiveAndStaleEntriesFromTheLocalIndex() {
    ResourceId projectId = ResourceId.newId();
    ResourceId ownerId = ResourceId.newId();
    LuceneContextIndex index = new LuceneContextIndex(indexRoot);
    index.index(entry(MemoryScope.PROJECT, projectId, ownerId,
                      MemoryEntry.IndexState.CURRENT, true),
                "secreto excluido");
    index.index(entry(MemoryScope.PROJECT, projectId, ownerId,
                      MemoryEntry.IndexState.STALE, false),
                "contexto desactualizado");

    List<ContextIndex.Result> results = index.search(projectId, ownerId, "contexto");

    assertThat(results).isEmpty();
  }

  @Test
  void rebuildsThePersistentIndexFromCurrentMetadataEntries() {
    ResourceId projectId = ResourceId.newId();
    ResourceId ownerId = ResourceId.newId();
    MemoryEntry current = entry(MemoryScope.PROJECT, projectId, ownerId,
                                MemoryEntry.IndexState.CURRENT, false);
    LuceneContextIndex index = new LuceneContextIndex(indexRoot);

    index.rebuild(List.of(new ContextIndex.IndexedEntry(current,
                                                        "contexto reconstruido")));

    assertThat(new LuceneContextIndex(indexRoot).search(projectId, ownerId,
                                                        "reconstruido"))
        .extracting(ContextIndex.Result::sourceId)
        .containsExactly(current.id());
  }

  private static MemoryEntry entry(MemoryScope scope, ResourceId projectId,
                                   ResourceId ownerId,
                                   MemoryEntry.IndexState state,
                                   boolean sensitive) {
    return new MemoryEntry(ResourceId.newId(), scope, projectId, ownerId,
                           "source.txt", "fingerprint", state, sensitive);
  }
}
