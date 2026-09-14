package com.zeko.coordination;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.coordination.application.AgentLoop;
import com.zeko.coordination.application.ExecutionGateway;
import com.zeko.coordination.domain.AutonomyMode;
import com.zeko.sharedkernel.domain.ResourceId;
import org.junit.jupiter.api.Test;

class AgentLoopIntegrationTest {
  @Test
  void assistedModeRequestsConfirmationRatherThanExecutingImplicitly() {
    StatusGateway gateway = new StatusGateway();
    AgentLoop loop = new AgentLoop(prompt -> "local", gateway);
    loop.respond(ResourceId.newId(), ResourceId.newId(), "proposal", AutonomyMode.ASSISTED);
    assertThat(gateway.status).isEqualTo("CONFIRMATION_REQUIRED");
  }
  private static final class StatusGateway implements ExecutionGateway {
    private String status;
    @Override
    public void report(ResourceId conversationId, String status, ResourceId relatedResourceId) {
      this.status = status;
    }
  }
}
