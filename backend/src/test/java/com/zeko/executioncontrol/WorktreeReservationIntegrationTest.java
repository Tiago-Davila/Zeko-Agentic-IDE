package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.sharedkernel.domain.ResourceId;
import org.junit.jupiter.api.Test;

class WorktreeReservationIntegrationTest {
  @Test
  void releasesTheOwnerBeforeAPathCanBeReused() {
    Worktree worktree = new Worktree(ResourceId.newId(), ResourceId.newId(),
                                     ResourceId.newId(), "logical", "physical",
                                     Worktree.State.RESERVED, null);
    assertThat(worktree.release().ownerExecutionId()).isNull();
  }
}
