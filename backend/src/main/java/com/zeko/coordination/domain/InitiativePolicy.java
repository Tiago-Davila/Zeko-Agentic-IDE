package com.zeko.coordination.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;

public final class InitiativePolicy {

  public FollowUpProposal propose(AutonomyMode mode, ResourceId instructionId,
                                  ResourceId agentId, String proposal,
                                  boolean instructionCurrent) {
    if (!instructionCurrent) {
      throw DomainError.conflict("La instruccion ya no esta vigente");
    }
    if (mode == AutonomyMode.MANUAL) {
      throw DomainError.forbidden("Manual no crea follow-ups");
    }
    return new FollowUpProposal(
        ResourceId.newId(), instructionId, agentId, proposal,
        FollowUpProposal.State.PENDING_CONFIRMATION, Instant.now());
  }

  public boolean createsWorkImmediately(AutonomyMode mode) {
    return mode == AutonomyMode.AUTONOMOUS;
  }
}
