package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;

public record EffectRecord(ResourceId id, ResourceId executionId, int sequence,
                           String type, String resource, boolean confirmed,
                           String safeDetail) {

  public EffectRecord {
    Objects.requireNonNull(id, "El efecto requiere identificador");
    Objects.requireNonNull(executionId, "El efecto requiere ejecucion");
    if (sequence < 1) {
      throw DomainError.validation("La secuencia de efecto debe ser positiva");
    }
    type = text(type, "tipo");
    resource = text(resource, "recurso");
    safeDetail = safe(safeDetail);
  }

  private static String text(String value, String field) {
    if (value == null || value.isBlank()) {
      throw DomainError.validation("El efecto requiere " + field);
    }
    return value.trim();
  }

  private static String safe(String value) {
    String detail = value == null ? "" : value.trim();
    if (detail.toLowerCase(java.util.Locale.ROOT)
            .matches(".*(token|password|secret|authorization).*")) {
      return "[REDACTED]";
    }
    return detail;
  }
}
