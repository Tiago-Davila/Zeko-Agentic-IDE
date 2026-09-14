package com.zeko.coordination.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.Objects;

public record
    Instruction(ResourceId id, ResourceId conversationId, Origin origin,
                String content, InstructionPrecedence precedence,
                ResourceId overrideOf, String overrideScope,
                ResourceId relatedResourceId, Instant createdAt) {

  public enum Origin {
    USER,
    PROJECT_RULES,
    PROJECT_MANAGER,
    AGENT,
    SKILL,
    DEFAULT
  }

  public Instruction {
    Objects.requireNonNull(id, "La instruccion requiere un identificador");
    Objects.requireNonNull(conversationId,
                           "La instruccion requiere una conversacion");
    Objects.requireNonNull(origin, "La instruccion requiere un origen");
    content = requireContent(content);
    Objects.requireNonNull(precedence,
                           "La instruccion requiere una precedencia");
    Objects.requireNonNull(createdAt,
                           "La instruccion requiere fecha de creacion");
    validateOrigin(origin, precedence);
    validateOverride(overrideOf, overrideScope, relatedResourceId, precedence);
  }

  public boolean overrides(Instruction other) {
    return overrideOf != null &&
        conversationId.equals(other.conversationId()) &&
        precedence.overrides(other.precedence());
  }

  private static String requireContent(String value) {
    if (value == null || value.isBlank()) {
      throw DomainError.validation("La instruccion requiere contenido");
    }
    return value.trim();
  }

  private static void validateOrigin(Origin origin,
                                     InstructionPrecedence precedence) {
    if (!InstructionPrecedence.valueOf(origin.name()).equals(precedence)) {
      throw DomainError.validation(
          "El origen y la precedencia de instruccion no coinciden");
    }
  }

  private static void validateOverride(ResourceId overrideOf, String scope,
                                       ResourceId relatedResourceId,
                                       InstructionPrecedence precedence) {
    if (overrideOf == null) {
      return;
    }
    if (precedence != InstructionPrecedence.USER || scope == null ||
        scope.isBlank() || relatedResourceId == null) {
      throw DomainError.validation(
          "Un override requiere usuario, alcance y decision relacionada");
    }
  }
}
