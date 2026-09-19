package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.domain.ExecutionSnapshot;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TemplateSnapshotIntegrationTest {
  @Test
  void freezesTheTemplateVersionForTheActiveAttempt() {
    ExecutionSnapshot snapshot = new ExecutionSnapshot(ResourceId.newId(), 2, "agent", Map.of());
    assertThat(snapshot.templateVersion()).isEqualTo(2);
  }
}
