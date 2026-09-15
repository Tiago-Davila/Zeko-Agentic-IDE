package com.zeko.memorysearch.application;

import com.zeko.coordination.application.ConversationContextProvider;
import com.zeko.memorysearch.domain.MemoryAccessPolicy;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class MemorySearchService {
  private final MemoryRepository entries;
  private final ContextIndex index;
  private final ConversationContextProvider conversations;
  private final MemoryAccessPolicy access = new MemoryAccessPolicy();

  public MemorySearchService(MemoryRepository entries, ContextIndex index,
                             ConversationContextProvider conversations) {
    this.entries = entries;
    this.index = index;
    this.conversations = conversations;
  }

  public List<ContextIndex.Result> search(ResourceId projectId,
                                          ResourceId conversationId, String query) {
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
}
