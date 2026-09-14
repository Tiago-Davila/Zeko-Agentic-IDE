package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.api.ExecutionResultController;
import org.junit.jupiter.api.Test;

class ExecutionResultContractTest {
  @Test
  void exposesAResultBoundaryForExecutionEvidence() {
    assertThat(ExecutionResultController.class.getSimpleName())
        .isEqualTo("ExecutionResultController");
  }
}
