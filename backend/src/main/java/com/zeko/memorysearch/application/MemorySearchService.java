package com.zeko.memorysearch.application;

import com.zeko.coordination.application.ConversationContextProvider;
import com.zeko.memorysearch.domain.MemoryAccessPolicy;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

@Service
public class MemorySearchService {
  private final MemoryRepository entries;
  private final ContextIndex index;
  private final ConversationContextProvider conversations;
  private final MemoryAccessPolicy access = new MemoryAccessPolicy();

  @Autowired
  public MemorySearchService(MemoryRepository entries, ContextIndex index,
                             @Lazy ConversationContextProvider conversations) {
    this.entries = entries;
    this.index = index;
    this.conversations = conversations;
  }

  public MemorySearchService(MemoryRepository entries, ContextIndex index) {
    this(entries, index, null);
  }

  public List<ContextIndex.Result> search(ResourceId projectId,
                                          ResourceId conversationId, String query) {
    if (conversations == null) {
      return search(projectId, List.of(conversationId), query);
    }
    MemoryAccessContext context = MemoryAccessContext.from(
        conversations.resolve(projectId, conversationId));
    return index.search(context, query)
        .stream()
        .filter(
            result
            -> entries.find(result.sourceId()).filter(
                entry -> access.permitsMetadata(entry, context.projectId(),
                    context.conversationId(), context.agentInstanceId()))
                   .isPresent())
        .toList();
  }

  public List<ContextIndex.Result> search(ResourceId projectId,
                                          List<ResourceId> ownerIds,
                                          String query) {
    return index.search(projectId, ownerIds, query)
        .stream()
        .filter(result -> entries.find(result.sourceId())
            .filter(entry -> access.permits(entry, projectId, ownerIds))
            .isPresent())
        .toList();
  }

  public List<ContextIndex.Result> search(ResourceId projectId,
                                          ResourceId ownerId, String query,
                                          boolean ownerSearch) {
    return search(projectId, List.of(ownerId), query);
  }
}
