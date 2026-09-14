package com.zeko.executioncontrol.api;

import com.zeko.executioncontrol.domain.EffectRecord;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.Task;
import java.util.List;

public final class ExecutionDtos {
  private ExecutionDtos() {}
  public record
      TaskInput(String projectId, String repositoryId, String agentInstanceId,
                String instructionId, String title) {}
  public record RetryInput(String retryOfExecutionId) {}
  public record
      TaskResponse(String id, String repositoryId, String state, String title) {
    static TaskResponse from(Task task) {
      return new TaskResponse(task.id().asString(),
                              task.repositoryId().asString(),
                              task.state().name(), task.title());
    }
  }
  public record
      Response(String id, String taskId, int attempt, String state,
               String knownState, String templateId, int templateVersion,
               String retryOfExecutionId, boolean cancellationRequested,
               List<EffectResponse> effects) {
    static Response from(Execution execution) {
      return new Response(
          execution.id().asString(), execution.taskId().asString(),
          execution.attempt(), execution.state().name(), execution.knownState(),
          execution.snapshot().templateId().asString(),
          execution.snapshot().templateVersion(),
          nullableId(execution.retryOf()), execution.cancellationRequested(),
          execution.effects().stream().map(EffectResponse::from).toList());
    }
  }
  public record EffectResponse(String id, String type, String resource,
                               boolean confirmed, String detail) {
    static EffectResponse from(EffectRecord effect) {
      return new EffectResponse(effect.id().asString(), effect.type(),
                                effect.resource(), effect.confirmed(),
                                effect.safeDetail());
    }
  }
  private static String
  nullableId(com.zeko.sharedkernel.domain.ResourceId value) {
    return value == null ? null : value.asString();
  }
}
