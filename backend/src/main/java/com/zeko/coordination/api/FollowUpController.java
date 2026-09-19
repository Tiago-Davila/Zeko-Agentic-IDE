package com.zeko.coordination.api;

import com.zeko.coordination.application.FollowUpService;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/follow-up-proposals")
public class FollowUpController {
  private final FollowUpService followUps;

  public FollowUpController(FollowUpService followUps) {
    this.followUps = followUps;
  }

  @PostMapping("/{followUpProposalId}/decisions")
  public FollowUpDtos.Response decide(@PathVariable String followUpProposalId,
                                      @RequestBody FollowUpDtos.DecisionInput input) {
    if (input == null || input.decision() == null) {
      throw DomainError.validation("La decision de follow-up es obligatoria");
    }
    return FollowUpDtos.Response.from(followUps.decide(
        ResourceId.parse(followUpProposalId), input.decision()));
  }
}
