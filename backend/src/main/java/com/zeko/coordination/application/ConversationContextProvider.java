package com.zeko.coordination.application;

import com.zeko.coordination.domain.Conversation;
import com.zeko.sharedkernel.domain.ResourceId;

public interface ConversationContextProvider {
  Context resolve(ResourceId projectId, ResourceId conversationId);

  record Context(ResourceId projectId, ResourceId conversationId,
                 Conversation.RecipientType recipientType,
                 ResourceId recipientId) {}
}
