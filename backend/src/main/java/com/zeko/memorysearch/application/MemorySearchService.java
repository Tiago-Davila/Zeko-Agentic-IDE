package com.zeko.memorysearch.application;

import com.zeko.memorysearch.domain.MemoryAccessPolicy;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class MemorySearchService {
  private final MemoryRepository entries;
  private final ContextIndex index;
  private final MemoryAccessPolicy access = new MemoryAccessPolicy();

  public MemorySearchService(MemoryRepository entries, ContextIndex index) {
    this.entries = entries;
    this.index = index;
  }

  public List<ContextIndex.Result> search(ResourceId projectId,
                                          ResourceId ownerId, String query) {
    return index.search(projectId, ownerId, query)
        .stream()
        .filter(
            result
            -> entries.find(result.sourceId())
                   .filter(entry -> access.permits(entry, projectId, ownerId))
                   .isPresent())
        .toList();
  }
}
