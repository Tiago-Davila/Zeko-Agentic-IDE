package com.zeko.coordination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.coordination.domain.Instruction;
import com.zeko.coordination.domain.InstructionPrecedence;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class InstructionPrecedenceTest {
  @Test
  void preservesUserAuthorityOverEveryLowerSource() {
    assertThat(InstructionPrecedence.USER.overrides(
                   InstructionPrecedence.PROJECT_RULES))
        .isTrue();
    assertThat(InstructionPrecedence.PROJECT_RULES.overrides(
                   InstructionPrecedence.PROJECT_MANAGER))
        .isTrue();
    assertThat(InstructionPrecedence.PROJECT_MANAGER.overrides(
                   InstructionPrecedence.AGENT))
        .isTrue();
  }

  @Test
  void requiresScopeAndRelatedDecisionForAUserOverride() {
    ResourceId conversationId = ResourceId.newId();
    Instruction lower =
        instruction(conversationId, Instruction.Origin.AGENT, null, null, null);
    Instruction override =
        instruction(conversationId, Instruction.Origin.USER, lower.id(),
                    "repository", ResourceId.newId());
    assertThat(override.overrides(lower)).isTrue();
    assertThatThrownBy(()
                           -> instruction(conversationId,
                                          Instruction.Origin.USER, lower.id(),
                                          null, null))
        .isInstanceOf(DomainError.class);
  }

  private static Instruction instruction(ResourceId conversationId,
                                         Instruction.Origin origin,
                                         ResourceId overrideOf, String scope,
                                         ResourceId related) {
    return new Instruction(
        ResourceId.newId(), conversationId, origin, "Continuar",
        InstructionPrecedence.valueOf(origin.name()), overrideOf, scope,
        related, Instant.parse("2026-09-14T18:00:00Z"));
  }
}
