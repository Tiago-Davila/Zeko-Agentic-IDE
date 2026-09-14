package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;

public record
    Worktree(ResourceId id, ResourceId repositoryId, ResourceId taskId,
             String logicalPath, String physicalPath, State state,
             ResourceId ownerExecutionId) {

  public enum State { RESERVED, ACTIVE, RELEASE_PENDING, RELEASED, CONFLICTED }

  public Worktree {
    Objects.requireNonNull(id, "El worktree requiere identificador");
    Objects.requireNonNull(repositoryId, "El worktree requiere repositorio");
    Objects.requireNonNull(taskId, "El worktree requiere task");
    logicalPath = path(logicalPath);
    physicalPath = path(physicalPath);
    Objects.requireNonNull(state, "El worktree requiere estado");
  }

  public Worktree activate(ResourceId executionId) {
    if (state != State.RESERVED || executionId == null) {
      throw DomainError.conflict(
          "El worktree no esta disponible para la ejecucion");
    }
    return new Worktree(id, repositoryId, taskId, logicalPath, physicalPath,
                        State.ACTIVE, executionId);
  }

  public Worktree release() {
    return new Worktree(id, repositoryId, taskId, logicalPath, physicalPath,
                        State.RELEASED, null);
  }

  private static String path(String value) {
    if (value == null || value.isBlank()) {
      throw DomainError.validation("El worktree requiere ruta");
    }
    return java.nio.file.Path.of(value).toAbsolutePath().normalize().toString();
  }
}
