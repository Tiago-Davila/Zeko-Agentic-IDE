package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.application.LocalActionResult;
import org.junit.jupiter.api.Test;

class AuthorizedActionDispatcherIntegrationTest {
  @Test
  void representsUnavailableAdaptersWithoutRetryingEffects() {
    assertThat(LocalActionResult.unavailable("blocked").status())
        .isEqualTo(LocalActionResult.Status.UNAVAILABLE);
  }
}
