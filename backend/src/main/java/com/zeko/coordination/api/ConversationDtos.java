package com.zeko.coordination.api;
import com.zeko.coordination.domain.Conversation;
import com.zeko.coordination.domain.Instruction;
import java.util.List;
public final class ConversationDtos {
  private ConversationDtos() {}
  public record CreateInput(String recipientType, String recipientId) {}
  public record InstructionInput(String content, String overrideOf,
                                 String scope, String relatedResourceId) {}
  public record ConversationResponse(String id, String projectId,
                                     String recipientType, String recipientId,
                                     List<InstructionResponse> instructions) {}
  public record InstructionResponse(String id, String origin, String content,
                                    String precedence, String overrideOf) {}
  public static ConversationResponse conversation(Conversation value) {
    return new ConversationResponse(
        value.id().asString(), value.projectId().asString(),
        value.recipientType().name(), value.recipientId().asString(),
        value.instructions()
            .stream()
            .map(ConversationDtos::instruction)
            .toList());
  }
  public static InstructionResponse instruction(Instruction value) {
    return new InstructionResponse(
        value.id().asString(), value.origin().name(), value.content(),
        value.precedence().name(),
        value.overrideOf() == null ? null : value.overrideOf().asString());
  }
}
