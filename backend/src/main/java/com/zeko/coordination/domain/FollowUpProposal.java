package com.zeko.coordination.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.Objects;

public record FollowUpProposal(ResourceId id, ResourceId instructionId,
                               ResourceId agentInstanceId, String proposal,
                               State state, Instant createdAt) {

  public enum State { PENDING_CONFIRMATION, ACCEPTED, REJECTED, EXPIRED }

  public FollowUpProposal {
    Objects.requireNonNull(id, "El follow-up requiere un identificador");
    Objects.requireNonNull(instructionId,
                           "El follow-up requiere una instruccion");
    Objects.requireNonNull(agentInstanceId, "El follow-up requiere un agente");
    if (proposal == null || proposal.isBlank()) {
      throw DomainError.validation("El follow-up requiere una propuesta");
    }
    Objects.requireNonNull(state, "El follow-up requiere un estado");
    Objects.requireNonNull(createdAt, "El follow-up requiere fecha");
  }

  public FollowUpProposal decide(boolean accepted, boolean sourceIsCurrent) {
    if (state != State.PENDING_CONFIRMATION) {
      throw DomainError.conflict("El follow-up ya fue decidido");
    }
    State next = sourceIsCurrent ? accepted ? State.ACCEPTED : State.REJECTED
                                 : State.EXPIRED;
    return new FollowUpProposal(id, instructionId, agentInstanceId, proposal,
                                next, createdAt);
  }
}
