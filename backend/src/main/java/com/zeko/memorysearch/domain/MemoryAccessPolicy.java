package com.zeko.memorysearch.domain;

import com.zeko.sharedkernel.domain.ResourceId;

public final class MemoryAccessPolicy {
  public boolean permits(MemoryEntry entry, ResourceId projectId,
                         ResourceId ownerId) {
    if (entry.sensitive() || entry.indexState() != MemoryEntry.IndexState.CURRENT) {
      return false;
    }
    if (entry.scope() == MemoryScope.GLOBAL) {
      return true;
    }
    return entry.projectId().equals(projectId) && entry.ownerId().equals(ownerId);
  }
}
