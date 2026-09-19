package com.zeko.coordination.api;

import com.zeko.coordination.domain.FollowUpProposal;

public final class FollowUpDtos {
  private FollowUpDtos() {}

  public record DecisionInput(String decision) {}

  public record Response(String id, String instructionId,
                         String agentInstanceId, String state) {
    static Response from(FollowUpProposal proposal) {
      return new Response(proposal.id().asString(),
                          proposal.instructionId().asString(),
                          proposal.agentInstanceId().asString(),
                          proposal.state().name());
    }
  }
}
