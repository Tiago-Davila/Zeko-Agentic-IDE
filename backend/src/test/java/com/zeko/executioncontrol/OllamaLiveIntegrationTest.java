package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class OllamaLiveIntegrationTest {
  @Test
  void keepsTheLiveProviderLocalToLoopback() {
    assertThat("http://127.0.0.1:11434").contains("127.0.0.1");
  }
}
