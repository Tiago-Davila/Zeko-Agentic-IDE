package com.zeko.coordination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.coordination.domain.AutonomyMode;
import com.zeko.coordination.domain.FollowUpProposal;
import com.zeko.coordination.domain.InitiativePolicy;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import org.junit.jupiter.api.Test;

class InitiativePolicyTest {
  @Test
  void separatesManualAssistedAndAutonomousInitiative() {
    InitiativePolicy policy = new InitiativePolicy();
    assertThatThrownBy(
        ()
            -> policy.propose(AutonomyMode.MANUAL, ResourceId.newId(),
                              ResourceId.newId(), "seguir", true))
        .isInstanceOf(DomainError.class);
    FollowUpProposal assisted =
        policy.propose(AutonomyMode.ASSISTED, ResourceId.newId(),
                       ResourceId.newId(), "seguir", true);
    assertThat(assisted.state())
        .isEqualTo(FollowUpProposal.State.PENDING_CONFIRMATION);
    assertThat(policy.createsWorkImmediately(AutonomyMode.ASSISTED)).isFalse();
    assertThat(policy.createsWorkImmediately(AutonomyMode.AUTONOMOUS)).isTrue();
  }
}
