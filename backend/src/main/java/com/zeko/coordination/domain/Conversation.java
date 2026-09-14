package com.zeko.coordination.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public record Conversation(ResourceId id, ResourceId projectId,
                           RecipientType recipientType, ResourceId recipientId,
                           List<Instruction> instructions) {

  public enum RecipientType { PM, AGENT }

  public Conversation {
    Objects.requireNonNull(id, "La conversacion requiere un identificador");
    Objects.requireNonNull(projectId, "La conversacion requiere un proyecto");
    Objects.requireNonNull(recipientType,
                           "La conversacion requiere un interlocutor");
    Objects.requireNonNull(recipientId,
                           "La conversacion requiere un destinatario");
    instructions = List.copyOf(instructions == null ? List.of() : instructions);
    for (Instruction instruction : instructions) {
      if (instruction == null || !id.equals(instruction.conversationId())) {
        throw DomainError.validation(
            "Cada instruccion debe pertenecer a la conversacion");
      }
    }
  }

  public Conversation append(Instruction instruction) {
    if (instruction == null || !id.equals(instruction.conversationId())) {
      throw DomainError.validation(
          "La instruccion no pertenece a la conversacion");
    }
    List<Instruction> updated = new ArrayList<>(instructions);
    updated.add(instruction);
    return new Conversation(id, projectId, recipientType, recipientId, updated);
  }
}
