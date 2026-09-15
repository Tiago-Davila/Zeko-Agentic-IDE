package com.zeko.memorysearch.application;

import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;

public interface ContextIndex {
  void index(MemoryEntry entry, String content);

  default void rebuild(List<IndexedEntry> entries) {
    entries.forEach(entry -> index(entry.entry(), entry.content()));
  }

  default List<Result> search(MemoryAccessContext context, String query) {
    ResourceId ownerId = context.agentInstanceId();
    if (ownerId == null) {
      return List.of();
    }
    return search(context.projectId(), ownerId, query);
  }

  default List<Result> search(ResourceId projectId, ResourceId ownerId, String query) {
    return List.of();
  }

  record IndexedEntry(MemoryEntry entry, String content) {}
  record Result(ResourceId sourceId, String level, ResourceId ownerId, String source,
                MemoryEntry.IndexState indexState, String excerpt) {
    public Result(ResourceId sourceId, String level, String excerpt) {
      this(sourceId, level, null, "", MemoryEntry.IndexState.CURRENT, excerpt);
    }
  }
}
