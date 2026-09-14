package com.zeko.coordination.infrastructure;

import com.zeko.coordination.application.ExecutionGateway;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.stereotype.Component;

@Component
public class LocalExecutionGateway implements ExecutionGateway {
  @Override
  public void report(ResourceId conversationId, String status,
                     ResourceId relatedResourceId) {}
}
