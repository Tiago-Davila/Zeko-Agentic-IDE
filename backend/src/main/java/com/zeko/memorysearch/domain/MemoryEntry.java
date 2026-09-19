package com.zeko.memorysearch.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;

public record MemoryEntry(ResourceId id, MemoryScope scope, ResourceId projectId,
                          ResourceId ownerId, String sourcePath, String fingerprint,
                          IndexState indexState, boolean sensitive) {
  public enum IndexState { CURRENT, STALE, UNAVAILABLE, EXCLUDED }

  public MemoryEntry {
    Objects.requireNonNull(id, "La fuente de memoria requiere identificador");
    Objects.requireNonNull(scope, "La fuente de memoria requiere alcance");
    if (scope == MemoryScope.GLOBAL) {
      if (projectId != null || ownerId == null) {
        throw DomainError.validation("La memoria global requiere propietario global");
      }
    } else if (projectId == null || ownerId == null) {
      throw DomainError.validation("La memoria requiere proyecto y propietario");
    }
    sourcePath = required(sourcePath, "ruta");
    fingerprint = fingerprint == null ? "" : fingerprint.trim();
    Objects.requireNonNull(indexState, "La fuente de memoria requiere estado");
  }

  public MemoryEntry withState(IndexState state) {
    return new MemoryEntry(id, scope, projectId, ownerId, sourcePath, fingerprint,
                           state, sensitive);
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank()) {
      throw DomainError.validation("La fuente de memoria requiere " + field);
    }
    return value.trim();
  }
}
