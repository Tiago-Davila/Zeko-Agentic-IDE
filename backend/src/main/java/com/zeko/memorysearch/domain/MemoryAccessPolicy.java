package com.zeko.memorysearch.domain;

import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;

public final class MemoryAccessPolicy {
  public boolean permits(MemoryEntry entry, ResourceId projectId,
                         ResourceId ownerId) {
    return permits(entry, projectId, List.of(ownerId));
  }

  public boolean permits(MemoryEntry entry, ResourceId projectId,
                         List<ResourceId> ownerIds) {
    if (entry.sensitive() || entry.indexState() != MemoryEntry.IndexState.CURRENT) {
      return false;
    }
    if (entry.scope() == MemoryScope.GLOBAL) {
      return true;
    }
    if (!entry.projectId().equals(projectId)) {
      return false;
    }
    return entry.scope() == MemoryScope.PROJECT || ownerIds.contains(entry.ownerId());
  }

  public boolean permitsMetadata(MemoryEntry entry, ResourceId projectId,
                                 ResourceId conversationId, ResourceId agentInstanceId) {
    if (entry.sensitive() || entry.indexState() == MemoryEntry.IndexState.EXCLUDED) {
      return false;
    }
    return owns(entry, projectId, conversationId, agentInstanceId);
  }

  public boolean permitsContent(MemoryEntry entry, ResourceId projectId,
                                ResourceId conversationId, ResourceId agentInstanceId) {
    return permitsMetadata(entry, projectId, conversationId, agentInstanceId)
        && entry.indexState() == MemoryEntry.IndexState.CURRENT;
  }

  private static boolean owns(MemoryEntry entry, ResourceId projectId,
                              ResourceId conversationId, ResourceId agentInstanceId) {
    return switch (entry.scope()) {
      case GLOBAL -> true;
      case PROJECT -> entry.projectId().equals(projectId);
      case AGENT -> entry.projectId().equals(projectId)
          && agentInstanceId != null
          && entry.ownerId().equals(agentInstanceId);
      case CONVERSATION -> entry.projectId().equals(projectId)
          && entry.ownerId().equals(conversationId);
    };
  }
}
