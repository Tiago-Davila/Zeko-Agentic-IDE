package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;

public record Task(ResourceId id, ResourceId projectId, ResourceId repositoryId,
                   ResourceId agentInstanceId, ResourceId instructionId,
                   String title, State state, String blockedReason) {

  public enum State {
    DRAFT,
    READY,
    RUNNING,
    COMPLETED,
    FAILED,
    CANCELLED,
    BLOCKED
  }

  public Task {
    Objects.requireNonNull(id, "La task requiere identificador");
    Objects.requireNonNull(projectId, "La task requiere proyecto");
    Objects.requireNonNull(repositoryId, "La task requiere repositorio");
    Objects.requireNonNull(agentInstanceId, "La task requiere agente");
    Objects.requireNonNull(instructionId, "La task requiere instruccion");
    if (title == null || title.isBlank()) {
      throw DomainError.validation("La task requiere un titulo");
    }
    title = title.trim();
    Objects.requireNonNull(state, "La task requiere estado");
    blockedReason = blockedReason == null ? "" : blockedReason.trim();
    if (state == State.BLOCKED && blockedReason.isBlank()) {
      throw DomainError.validation("Una task bloqueada requiere motivo");
    }
  }

  public Task transition(State next) {
    Objects.requireNonNull(next, "El estado de task es obligatorio");
    if (state == State.BLOCKED && next == State.READY) {
      throw DomainError.conflict(
          "Una task bloqueada requiere resolucion explicita");
    }
    return new Task(id, projectId, repositoryId, agentInstanceId, instructionId,
                    title, next, next == State.BLOCKED ? blockedReason : "");
  }

  public Task block(String reason) {
    return new Task(id, projectId, repositoryId, agentInstanceId, instructionId,
                    title, State.BLOCKED, reason);
  }
}
