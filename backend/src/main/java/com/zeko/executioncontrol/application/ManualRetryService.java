package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.Execution;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.stereotype.Service;

@Service
public class ManualRetryService {
  private final ExecutionService executions;
  private final ExecutionActivationService activation;
  public ManualRetryService(ExecutionService executions,
                            ExecutionActivationService activation) {
    this.executions = executions;
    this.activation = activation;
  }
  public Execution retry(ResourceId executionId) {
    Execution previous = executions.find(executionId);
    return activation.start(previous.taskId(), previous.id());
  }
}
