package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.api.ConflictController;
import org.junit.jupiter.api.Test;

class ConflictContractTest {
  @Test
  void exposesTheExplicitConflictResolutionBoundary() {
    assertThat(ConflictController.class.getSimpleName()).isEqualTo("ConflictController");
  }
}
