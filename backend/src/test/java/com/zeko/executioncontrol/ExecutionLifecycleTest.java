package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.ExecutionSnapshot;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ExecutionLifecycleTest {
  @Test
  void onlyConfirmsCancellationAfterTheAdapterReportsIt() {
    Execution execution = execution();
    assertThatThrownBy(() -> execution.transition(Execution.State.CANCELLED, "CANCELLED"))
        .isInstanceOf(RuntimeException.class);
    Execution requested = execution.requestCancellation();
    assertThat(requested.state()).isEqualTo(Execution.State.RUNNING);
    assertThat(requested.confirmCancelled("CONFIRMED").state()).isEqualTo(Execution.State.CANCELLED);
  }

  @Test
  void keepsAnImmutableSnapshotAndSeparateKnownState() {
    Execution execution = execution();
    assertThat(execution.snapshot().context()).isUnmodifiable();
    assertThat(execution.transition(Execution.State.COMPLETED, "UNKNOWN").knownState()).isEqualTo("UNKNOWN");
  }

  private static Execution execution() {
    return new Execution(ResourceId.newId(), ResourceId.newId(), 1, Execution.State.RUNNING,
                         new ExecutionSnapshot(ResourceId.newId(), 1, "agent", Map.of("scope", "local")),
                         null, "RUNNING", false, java.util.List.of());
  }
}
