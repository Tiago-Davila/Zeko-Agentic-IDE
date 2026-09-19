package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.executioncontrol.application.CapabilityRegistry;
import com.zeko.executioncontrol.application.LocalActionAdapter;
import com.zeko.executioncontrol.application.LocalActionResult;
import com.zeko.executioncontrol.application.LocalCapability;
import com.zeko.executioncontrol.domain.ActionProposal;
import java.util.List;
import org.junit.jupiter.api.Test;

class CapabilityRegistryTest {
  @Test
  void acceptsOnlyOneAdapterForEachClosedCapability() {
    LocalActionAdapter adapter = new Adapter();
    CapabilityRegistry registry = new CapabilityRegistry(List.of(adapter));
    assertThat(registry.supports(LocalCapability.FILESYSTEM)).isTrue();
    assertThatThrownBy(() -> new CapabilityRegistry(List.of(adapter, adapter))).isInstanceOf(RuntimeException.class);
  }

  private static final class Adapter implements LocalActionAdapter {
    @Override
    public LocalCapability capability() {
      return LocalCapability.FILESYSTEM;
    }
    @Override
    public LocalActionResult execute(ActionProposal action) {
      return LocalActionResult.unavailable("test");
    }
  }
}
