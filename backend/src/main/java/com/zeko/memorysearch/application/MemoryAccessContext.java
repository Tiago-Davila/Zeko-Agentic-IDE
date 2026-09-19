package com.zeko.memorysearch.application;

import com.zeko.coordination.application.ConversationContextProvider;
import com.zeko.coordination.domain.Conversation;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;

public record MemoryAccessContext(ResourceId projectId, ResourceId conversationId,
                                  ResourceId agentInstanceId) {
  public MemoryAccessContext {
    Objects.requireNonNull(projectId, "El contexto de memoria requiere proyecto");
    Objects.requireNonNull(conversationId,
                           "El contexto de memoria requiere conversacion");
  }

  public static MemoryAccessContext from(ConversationContextProvider.Context context) {
    ResourceId agent = context.recipientType() == Conversation.RecipientType.AGENT
        ? context.recipientId() : null;
    return new MemoryAccessContext(context.projectId(), context.conversationId(), agent);
  }
}
