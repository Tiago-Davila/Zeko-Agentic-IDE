package com.zeko.executioncontrol.application;

import com.zeko.sharedkernel.domain.DomainError;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class CapabilityRegistry {
  private final Map<LocalCapability, LocalActionAdapter> adapters;
  public CapabilityRegistry(List<LocalActionAdapter> adapters) {
    EnumMap<LocalCapability, LocalActionAdapter> registered =
        new EnumMap<>(LocalCapability.class);
    for (LocalActionAdapter adapter : adapters) {
      if (registered.putIfAbsent(adapter.capability(), adapter) != null) {
        throw DomainError.conflict("Una capacidad local ya tiene adaptador");
      }
    }
    this.adapters = Map.copyOf(registered);
  }
  public LocalActionAdapter require(LocalCapability capability) {
    LocalActionAdapter adapter = adapters.get(capability);
    if (adapter == null) {
      throw DomainError.providerUnavailable(
          "La capacidad local no esta integrada");
    }
    return adapter;
  }
  public boolean supports(LocalCapability capability) {
    return adapters.containsKey(capability);
  }
}
