package com.zeko.coordination;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.coordination.application.CoordinationService;
import com.zeko.coordination.application.ExecutionGateway;
import com.zeko.sharedkernel.domain.ResourceId;
import org.junit.jupiter.api.Test;

class CoordinationIntegrationTest {
  @Test
  void reportsThroughTheGatewayWithoutExecutingWork() {
    RecordingGateway gateway = new RecordingGateway();
    new CoordinationService(gateway).report(ResourceId.newId(), "BLOCKED",
                                            ResourceId.newId());
    assertThat(gateway.reported).isTrue();
  }
  private static final class RecordingGateway implements ExecutionGateway {
    private boolean reported;
    @Override
    public void report(ResourceId conversationId, String status,
                       ResourceId relatedResourceId) {
      reported = true;
    }
  }
}
