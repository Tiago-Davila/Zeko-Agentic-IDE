package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.infrastructure.LocalDockerAdapter;
import org.junit.jupiter.api.Test;

class DockerAdapterTest {
  @Test
  void reportsAKnownLocalAvailabilityStateWithoutPullingImages() {
    assertThat(new LocalDockerAdapter().capability().name()).isEqualTo("DOCKER");
  }
}
