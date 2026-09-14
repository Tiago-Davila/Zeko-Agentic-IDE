package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.domain.EffectRecord;
import com.zeko.sharedkernel.domain.ResourceId;
import org.junit.jupiter.api.Test;

class ExecutionStoreIntegrationTest {
  @Test
  void preservesOnlySafeEffectDetailsForPersistence() {
    EffectRecord effect = new EffectRecord(ResourceId.newId(), ResourceId.newId(), 1,
                                           "WRITE", "file", true, "token=secret");
    assertThat(effect.safeDetail()).isEqualTo("[REDACTED]");
  }
}
