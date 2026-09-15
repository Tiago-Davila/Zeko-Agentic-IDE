package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.zeko.executioncontrol.api.ExecutionController;
import com.zeko.executioncontrol.api.ExecutionDtos;
import com.zeko.executioncontrol.application.ExecutionService;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.ExecutionSnapshot;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ExecutionProviderTest {
  @Test
  void exposesOnlyTheExplicitlyConfirmedProviderInTheProjectSnapshot() {
    ResourceId project = ResourceId.newId();
    Execution execution = execution(Execution.Provider.OLLAMA, "UNAVAILABLE");
    ExecutionService service = mock(ExecutionService.class);
    when(service.snapshot(project)).thenReturn(
        new ExecutionService.RuntimeSnapshot(project, List.of(execution), List.of()));

    ExecutionDtos.RuntimeSnapshotResponse snapshot =
        new ExecutionController(service).snapshot(project.asString());

    assertThat(snapshot.projectId()).isEqualTo(project.asString());
    assertThat(snapshot.executions()).singleElement().satisfies(result -> {
      assertThat(result.provider()).isEqualTo("OLLAMA");
      assertThat(result.knownState()).isEqualTo("UNAVAILABLE");
    });
  }

  @Test
  void keepsProviderUnknownWhenOnlyTheKnownStateNamesDocker() {
    Execution execution = execution(null, "Docker no disponible");

    assertThat(execution.provider()).isNull();
  }

  private static Execution execution(Execution.Provider provider, String knownState) {
    return new Execution(ResourceId.newId(), ResourceId.newId(), 1, Execution.State.FAILED,
        new ExecutionSnapshot(ResourceId.newId(), 1, "agent", Map.of()), null,
        knownState, provider, false, List.of());
  }
}
