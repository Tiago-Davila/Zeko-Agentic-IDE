package com.zeko.coordination.infrastructure;

import com.zeko.coordination.application.ExecutionGateway;
import com.zeko.sharedkernel.domain.ResourceId;
import com.zeko.traceability.application.TraceRecorder;
import com.zeko.traceability.domain.SafeDetail;
import com.zeko.traceability.domain.TraceLink;
import java.time.Instant;
import java.util.Map;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Component
@Primary
public class ExecutionGatewayAdapter implements ExecutionGateway {
  private final TraceRecorder traces;

  public ExecutionGatewayAdapter(TraceRecorder traces) {
    this.traces = traces;
  }

  @Override
  public void report(ResourceId conversationId, String status,
                     ResourceId relatedResourceId) {
    traces.record(new TraceLink(ResourceId.newId(), "conversation",
                                conversationId, "instruction",
                                relatedResourceId, status, Instant.now()),
                  new SafeDetail(Map.of("status", status)));
  }
}
