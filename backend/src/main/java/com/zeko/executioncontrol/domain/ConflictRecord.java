package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

public record ConflictRecord(ResourceId id, ResourceId taskId, Type type,
                             List<String> resources, State state,
                             Instant detectedAt, String resolution) {

  public enum Type { WORKTREE_OWNERSHIP, MANUAL_INTEGRATION }
  public enum State { OPEN, CANCELLED, REASSIGNED, RESOLVED_MANUALLY }

  public ConflictRecord {
    Objects.requireNonNull(id, "El conflicto requiere identificador");
    Objects.requireNonNull(taskId, "El conflicto requiere task");
    Objects.requireNonNull(type, "El conflicto requiere tipo");
    resources = resources == null ? List.of() : List.copyOf(resources);
    if (resources.isEmpty()) {
      throw DomainError.validation("El conflicto requiere recursos");
    }
    Objects.requireNonNull(state, "El conflicto requiere estado");
    Objects.requireNonNull(detectedAt, "El conflicto requiere fecha");
    resolution = resolution == null ? "" : resolution.trim();
  }

  public ConflictRecord resolve(State next, String note) {
    if (state != State.OPEN || next == State.OPEN) {
      throw DomainError.conflict("El conflicto ya fue resuelto");
    }
    return new ConflictRecord(id, taskId, type, resources, next, detectedAt,
                              note);
  }
}
