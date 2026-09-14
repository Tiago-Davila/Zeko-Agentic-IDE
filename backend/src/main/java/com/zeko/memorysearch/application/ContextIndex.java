package com.zeko.memorysearch.application;

import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;

public interface ContextIndex {
  void index(MemoryEntry entry, String content);
  List<Result> search(ResourceId projectId, ResourceId ownerId, String query);
  record Result(ResourceId sourceId, String level, String excerpt) {}
}
