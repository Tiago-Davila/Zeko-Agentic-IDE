package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.infrastructure.OllamaLocalClient;
import org.junit.jupiter.api.Test;

class OllamaClientContractTest {
  @Test
  void rejectsAnIncompleteLocalGenerationRequestWithoutNetworkAccess() {
    assertThat(new OllamaLocalClient().generate("", "prompt").status().name()).isEqualTo("FAILED");
  }
}
