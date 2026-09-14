package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.Execution;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.stereotype.Service;

@Service
public class ManualRetryService {
  private final ExecutionService executions;
  public ManualRetryService(ExecutionService executions) {
    this.executions = executions;
  }
  public Execution retry(ResourceId executionId) {
    Execution previous = executions.find(executionId);
    return executions.start(previous.taskId(), previous.id());
  }
}
