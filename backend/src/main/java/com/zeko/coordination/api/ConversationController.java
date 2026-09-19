package com.zeko.coordination.api;

import com.zeko.coordination.application.ConversationService;
import com.zeko.coordination.domain.Conversation;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ConversationController {
  private final ConversationService conversations;
  public ConversationController(ConversationService conversations) {
    this.conversations = conversations;
  }
  @PostMapping("/projects/{projectId}/conversations")
  public ResponseEntity<ConversationDtos.ConversationResponse>
  create(@PathVariable String projectId,
         @RequestBody ConversationDtos.CreateInput input) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ConversationDtos.conversation(conversations.create(
            ResourceId.parse(projectId),
            Conversation.RecipientType.valueOf(input.recipientType()),
            ResourceId.parse(input.recipientId()))));
  }
  @GetMapping("/conversations/{conversationId}")
  public ConversationDtos.ConversationResponse
  find(@PathVariable String conversationId) {
    return ConversationDtos.conversation(
        conversations.find(ResourceId.parse(conversationId)));
  }
  @PostMapping("/conversations/{conversationId}/messages")
  public ResponseEntity<ConversationDtos.ExchangeResponse>
  message(@PathVariable String conversationId,
          @RequestBody ConversationDtos.InstructionInput input) {
    return ResponseEntity.accepted().body(ConversationDtos.exchange(
        conversations.instructAndRespond(ResourceId.parse(conversationId),
                                          input.content(),
                                          resourceId(input.overrideOf()),
                                          input.scope(),
                                          resourceId(input.relatedResourceId()))));
  }
  private static ResourceId resourceId(String value) {
    return value == null ? null : ResourceId.parse(value);
  }
}
