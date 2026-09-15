package com.zeko.memorysearch.domain;

import com.zeko.sharedkernel.domain.ResourceId;

public final class MemoryAccessPolicy {
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
