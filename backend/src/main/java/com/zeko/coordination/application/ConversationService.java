package com.zeko.coordination.application;

import com.zeko.coordination.domain.Conversation;
import com.zeko.coordination.domain.Instruction;
import com.zeko.coordination.domain.InstructionPrecedence;
import com.zeko.coordination.domain.AutonomyMode;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ConversationService implements ConversationContextProvider {
  private final ConversationRepository conversations;
  private final AgentLoop agentLoop;

  public ConversationService(ConversationRepository conversations,
                             AgentLoop agentLoop) {
    this.conversations = conversations;
    this.agentLoop = agentLoop;
  }

  public Conversation create(ResourceId projectId,
                             Conversation.RecipientType type,
                             ResourceId recipientId) {
    Conversation conversation = new Conversation(ResourceId.newId(), projectId,
                                                 type, recipientId, List.of());
    conversations.save(conversation);
    return conversation;
  }

  public Conversation find(ResourceId conversationId) {
    return conversations.findById(conversationId)
        .orElseThrow(
            () -> DomainError.notFound("Conversation", conversationId));
  }

  @Override
  public ConversationContextProvider.Context resolve(ResourceId projectId,
                                                      ResourceId conversationId) {
    Conversation conversation = find(conversationId);
    if (!conversation.projectId().equals(projectId)) {
      throw DomainError.forbidden("La conversacion no pertenece al proyecto activo");
    }
    return new ConversationContextProvider.Context(
        conversation.projectId(), conversation.id(), conversation.recipientType(),
        conversation.recipientId());
  }

  public Instruction instruct(ResourceId conversationId, String content,
                              ResourceId overrideOf, String scope,
                              ResourceId related) {
    Conversation conversation = find(conversationId);
    Instruction existing = overriddenInstruction(conversation, overrideOf);
    Instruction instruction = new Instruction(
        ResourceId.newId(), conversationId, Instruction.Origin.USER, content,
        InstructionPrecedence.USER, overrideOf, scope, related, Instant.now());
    if (existing != null && !instruction.overrides(existing)) {
      throw DomainError.validation(
          "El override debe superar la precedencia previa");
    }
    conversations.append(instruction);
    return instruction;
  }

  public Exchange instructAndRespond(ResourceId conversationId, String content,
                                     ResourceId overrideOf, String scope,
                                     ResourceId related) {
    Conversation conversation = find(conversationId);
    Instruction instruction = instruct(conversationId, content, overrideOf,
                                       scope, related);
    String response = agentLoop.respond(conversationId, instruction.id(),
                                        instruction.content(),
                                        AutonomyMode.MANUAL);
    Instruction responseInstruction = new Instruction(
        ResourceId.newId(), conversationId, responseOrigin(conversation),
        response, responsePrecedence(conversation), null, null,
        instruction.id(), Instant.now());
    conversations.append(responseInstruction);
    return new Exchange(instruction, responseInstruction,
                         find(conversationId));
  }

  private static Instruction overriddenInstruction(Conversation conversation,
                                                   ResourceId overrideOf) {
    if (overrideOf == null) {
      return null;
    }
    return conversation.instructions()
        .stream()
        .filter(instruction -> instruction.id().equals(overrideOf))
        .findFirst()
        .orElseThrow(
            ()
                -> DomainError.validation("El override debe referenciar una " +
                                          "instruccion de la conversacion"));
  }

  private static Instruction.Origin responseOrigin(Conversation conversation) {
    return conversation.recipientType() == Conversation.RecipientType.PM
        ? Instruction.Origin.PROJECT_MANAGER
        : Instruction.Origin.AGENT;
  }

  private static InstructionPrecedence responsePrecedence(
      Conversation conversation) {
    return conversation.recipientType() == Conversation.RecipientType.PM
        ? InstructionPrecedence.PROJECT_MANAGER
        : InstructionPrecedence.AGENT;
  }

  public record Exchange(Instruction instruction, Instruction response,
                         Conversation conversation) {}
}
