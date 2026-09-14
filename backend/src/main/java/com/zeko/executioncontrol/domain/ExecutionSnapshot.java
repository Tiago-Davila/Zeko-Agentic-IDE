package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Map;
import java.util.Objects;

public record
    ExecutionSnapshot(ResourceId templateId, int templateVersion,
                      String agentIdentity, Map<String, String> context) {

  public ExecutionSnapshot {
    Objects.requireNonNull(templateId, "El snapshot requiere plantilla");
    if (templateVersion < 1) {
      throw DomainError.validation("El snapshot requiere version positiva");
    }
    if (agentIdentity == null || agentIdentity.isBlank()) {
      throw DomainError.validation("El snapshot requiere identidad de agente");
    }
    agentIdentity = agentIdentity.trim();
    context = context == null ? Map.of() : Map.copyOf(context);
  }
}
