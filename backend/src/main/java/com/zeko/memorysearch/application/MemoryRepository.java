package com.zeko.memorysearch.application;

import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Optional;

public interface MemoryRepository {
  void save(MemoryEntry entry);
  Optional<MemoryEntry> find(ResourceId id);
  List<MemoryEntry> findForProject(ResourceId projectId);
}
