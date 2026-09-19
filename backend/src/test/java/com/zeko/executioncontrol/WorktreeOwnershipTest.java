package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.executioncontrol.domain.Task;
import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.sharedkernel.domain.ResourceId;
import org.junit.jupiter.api.Test;

class WorktreeOwnershipTest {
  @Test
  void activatesOnlyAReservedWorktreeAndDoesNotReopenBlockedTasks() {
    Worktree worktree = new Worktree(ResourceId.newId(), ResourceId.newId(),
                                     ResourceId.newId(), "logical", "physical",
                                     Worktree.State.RESERVED, null);
    assertThat(worktree.activate(ResourceId.newId()).state()).isEqualTo(Worktree.State.ACTIVE);
    Task task = new Task(ResourceId.newId(), ResourceId.newId(),
                         ResourceId.newId(), ResourceId.newId(),
                         ResourceId.newId(), "blocked", Task.State.BLOCKED,
                         "conflict");
    assertThatThrownBy(() -> task.transition(Task.State.READY)).isInstanceOf(RuntimeException.class);
  }
}
