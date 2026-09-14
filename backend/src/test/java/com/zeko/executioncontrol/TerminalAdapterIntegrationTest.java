package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.executioncontrol.infrastructure.LocalTerminalAdapter;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class TerminalAdapterIntegrationTest {
  @TempDir Path worktree;
  @Test
  void runsArgumentBasedProcessInTheSelectedWorkingDirectory() {
    ActionProposal action = new ActionProposal(
        ResourceId.newId(), ResourceId.newId(), null, ResourceId.newId(),
        "EXECUTE_LOCAL", "terminal", "local", worktree.toString(),
        List.of("sh", "-c", "printf local"), "", Set.of("terminal"),
        PermissionPolicy.ActionCategory.READ_LOCAL, 1);
    assertThat(new LocalTerminalAdapter().execute(action).safeOutput()).contains("local");
  }
}
