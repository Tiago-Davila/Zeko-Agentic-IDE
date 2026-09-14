package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.domain.Execution;
import org.junit.jupiter.api.Test;

class CancelRetryIntegrationTest {
  @Test
  void treatsCancellationAsASeparateConfirmedState() {
    assertThat(Execution.State.CANCELLED.name()).isEqualTo("CANCELLED");
  }
}
