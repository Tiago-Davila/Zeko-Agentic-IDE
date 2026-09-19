package com.zeko.coordination.application;

import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.stereotype.Service;

@Service
public class CoordinationService {
  private final ExecutionGateway gateway;
  public CoordinationService(ExecutionGateway gateway) {
    this.gateway = gateway;
  }
  public void report(ResourceId conversationId, String status,
                     ResourceId relatedResourceId) {
    gateway.report(conversationId, status, relatedResourceId);
  }
}
