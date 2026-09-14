package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.sharedkernel.domain.ResourceId;

public interface LocalActionAdapter {
  LocalCapability capability();
  LocalActionResult execute(ActionProposal action);
  default boolean cancel(ResourceId executionId) {
    return false;
  }
}
