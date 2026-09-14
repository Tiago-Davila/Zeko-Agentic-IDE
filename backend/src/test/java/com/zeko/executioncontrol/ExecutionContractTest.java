package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.api.ExecutionDtos;
import org.junit.jupiter.api.Test;

class ExecutionContractTest {
  @Test
  void exposesTheExecutionContractDto() {
    assertThat(ExecutionDtos.class.getSimpleName()).isEqualTo("ExecutionDtos");
  }
}
