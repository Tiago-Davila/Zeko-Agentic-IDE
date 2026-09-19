package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.Execution;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.stereotype.Service;

@Service
public class CancellationService {
  private final ExecutionService service;
  private final ExecutionRepository repository;
  private final CapabilityRegistry capabilities;
  public CancellationService(ExecutionService service,
                             ExecutionRepository repository,
                             CapabilityRegistry capabilities) {
    this.service = service;
    this.repository = repository;
    this.capabilities = capabilities;
  }
  public Execution request(ResourceId executionId) {
    Execution requested = service.find(executionId).requestCancellation();
    repository.saveExecution(requested);
    return requested;
  }
  public Execution confirm(ResourceId executionId, LocalCapability capability) {
    Execution requested = service.find(executionId);
    if (!capabilities.require(capability).cancel(executionId)) {
      return requested;
    }
    Execution cancelled = requested.confirmCancelled("CANCELLED_CONFIRMED");
    repository.saveExecution(cancelled);
    return cancelled;
  }
}
