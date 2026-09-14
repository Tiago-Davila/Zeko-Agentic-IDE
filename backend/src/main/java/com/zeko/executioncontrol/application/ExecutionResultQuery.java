package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.EffectRecord;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ExecutionResultQuery {
  private final ExecutionRepository executions;

  public ExecutionResultQuery(ExecutionRepository executions) {
    this.executions = executions;
  }

  public Result find(ResourceId executionId) {
    Execution execution =
        executions.findExecution(executionId)
            .orElseThrow(() -> DomainError.notFound("Execution", executionId));
    List<EffectRecord> effects = execution.effects();
    String attributable = effects.stream()
                              .filter(EffectRecord::confirmed)
                              .map(EffectRecord::safeDetail)
                              .reduce("", (left, right) -> left + right + "\n");
    String previous = effects.stream()
                          .filter(effect -> !effect.confirmed())
                          .map(EffectRecord::safeDetail)
                          .reduce("", (left, right) -> left + right + "\n");
    return new Result(execution, attributable.trim(), previous.trim());
  }

  public record Result(Execution execution, String attributableDiff,
                       String previousChanges) {}
}
