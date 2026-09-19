package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.zeko.executioncontrol.application.CancellationService;
import com.zeko.executioncontrol.application.CapabilityRegistry;
import com.zeko.executioncontrol.application.ExecutionActivationService;
import com.zeko.executioncontrol.application.ExecutionRepository;
import com.zeko.executioncontrol.application.ExecutionService;
import com.zeko.executioncontrol.application.LocalActionAdapter;
import com.zeko.executioncontrol.application.LocalActionResult;
import com.zeko.executioncontrol.application.LocalCapability;
import com.zeko.executioncontrol.application.ManualRetryService;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.ExecutionSnapshot;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CancelRetryIntegrationTest {

  @Test
  void persistsCancellationOnlyAfterTheLocalAdapterConfirmsIt() {
    ResourceId executionId = ResourceId.newId();
    Execution running = execution(executionId, ResourceId.newId(), 1,
        Execution.State.RUNNING, null, false);
    Execution requested = running.requestCancellation();
    Execution cancelled = requested.confirmCancelled("CANCELLED_CONFIRMED");
    ExecutionService executions = mock(ExecutionService.class);
    when(executions.find(executionId)).thenReturn(running, requested);
    ExecutionRepository repository = mock(ExecutionRepository.class);
    CancellationService cancellations = new CancellationService(
        executions, repository, new CapabilityRegistry(List.of(confirmingAdapter())));

    assertThat(cancellations.request(executionId)).isEqualTo(requested);
    assertThat(cancellations.confirm(executionId, LocalCapability.TERMINAL))
        .isEqualTo(cancelled);

    verify(repository).saveExecution(requested);
    verify(repository).saveExecution(cancelled);
  }

  @Test
  void startsASeparateAttemptOnlyWhenTheUserRequestsARetry() {
    ResourceId taskId = ResourceId.newId();
    Execution previous = execution(ResourceId.newId(), taskId, 1,
        Execution.State.FAILED, null, false);
    Execution retry = execution(ResourceId.newId(), taskId, 2,
        Execution.State.RUNNING, previous.id(), false);
    ExecutionService executions = mock(ExecutionService.class);
    when(executions.find(previous.id())).thenReturn(previous);
    ExecutionActivationService activation = mock(ExecutionActivationService.class);
    when(activation.start(taskId, previous.id())).thenReturn(retry);
    ManualRetryService retries = new ManualRetryService(executions, activation);

    Execution result = retries.retry(previous.id());

    assertThat(result.attempt()).isEqualTo(2);
    assertThat(result.retryOf()).isEqualTo(previous.id());
    verify(activation).start(taskId, previous.id());
  }

  private static LocalActionAdapter confirmingAdapter() {
    return new LocalActionAdapter() {
      @Override
      public LocalCapability capability() {
        return LocalCapability.TERMINAL;
      }

      @Override
      public LocalActionResult execute(com.zeko.executioncontrol.domain.ActionProposal action) {
        return new LocalActionResult(LocalActionResult.Status.COMPLETED, "DONE", List.of(), "");
      }

      @Override
      public boolean cancel(ResourceId executionId) {
        return true;
      }
    };
  }

  private static Execution execution(ResourceId executionId, ResourceId taskId, int attempt,
                                     Execution.State state, ResourceId retryOf,
                                     boolean cancellationRequested) {
    return new Execution(
        executionId, taskId, attempt, state,
        new ExecutionSnapshot(ResourceId.newId(), 1, "agent", Map.of()), retryOf,
        state.name(), cancellationRequested, List.of());
  }
}
