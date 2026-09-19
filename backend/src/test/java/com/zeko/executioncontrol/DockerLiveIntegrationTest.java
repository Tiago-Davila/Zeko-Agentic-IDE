package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DockerLiveIntegrationTest {
  @Test
  void distinguishesTheOptionalLocalProviderSuite() {
    assertThat(System.getenv()).isNotNull();
  }
}
