package com.zeko.coordination.application;

import com.zeko.sharedkernel.domain.ResourceId;

public interface ExecutionGateway {
  void report(ResourceId conversationId, String status,
              ResourceId relatedResourceId);
}
