package com.zeko.memorysearch.application;

import com.zeko.memorysearch.domain.MemoryEntry;
import java.util.List;

public interface ContextIndex {
  void index(MemoryEntry entry, String content);
  List<Result> search(MemoryAccessContext context, String query);
  record Result(com.zeko.sharedkernel.domain.ResourceId sourceId, String level,
                com.zeko.sharedkernel.domain.ResourceId ownerId, String source,
                MemoryEntry.IndexState indexState, String excerpt) {}
}
