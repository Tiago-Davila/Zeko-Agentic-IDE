package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Objects;

public record
    Execution(ResourceId id, ResourceId taskId, int attempt, State state,
              ExecutionSnapshot snapshot, ResourceId retryOf, String knownState,
              boolean cancellationRequested, List<EffectRecord> effects) {

  public enum State {
    PENDING,
    RUNNING,
    WAITING_APPROVAL,
    COMPLETED,
    FAILED,
    CANCELLED
  }

  public Execution {
    Objects.requireNonNull(id, "La ejecucion requiere identificador");
    Objects.requireNonNull(taskId, "La ejecucion requiere task");
    if (attempt < 1) {
      throw DomainError.validation("El intento de ejecucion debe ser positivo");
    }
    Objects.requireNonNull(state, "La ejecucion requiere estado");
    Objects.requireNonNull(snapshot, "La ejecucion requiere snapshot");
    knownState = knownState == null ? "UNKNOWN" : knownState.trim();
    effects = effects == null ? List.of() : List.copyOf(effects);
  }

  public Execution transition(State next, String nextKnownState) {
    Objects.requireNonNull(next, "El estado de ejecucion es obligatorio");
    if (state == State.CANCELLED || state == State.COMPLETED ||
        state == State.FAILED) {
      throw DomainError.conflict(
          "Una ejecucion finalizada no puede reanudarse");
    }
    if (next == State.CANCELLED && !cancellationRequested) {
      throw DomainError.conflict(
          "La cancelacion requiere confirmacion del adaptador");
    }
    return new Execution(id, taskId, attempt, next, snapshot, retryOf,
                         nextKnownState, cancellationRequested, effects);
  }

  public Execution requestCancellation() {
    if (state != State.RUNNING && state != State.WAITING_APPROVAL) {
      throw DomainError.conflict(
          "Solo una ejecucion activa puede solicitar cancelacion");
    }
    return new Execution(id, taskId, attempt, state, snapshot, retryOf,
                         knownState, true, effects);
  }

  public Execution confirmCancelled(String known) {
    if (!cancellationRequested) {
      throw DomainError.conflict("No existe una solicitud de cancelacion");
    }
    return new Execution(id, taskId, attempt, State.CANCELLED, snapshot,
                         retryOf, known, true, effects);
  }

  public Execution record(EffectRecord effect) {
    Objects.requireNonNull(effect, "El efecto es obligatorio");
    if (!id.equals(effect.executionId())) {
      throw DomainError.validation("El efecto no pertenece a la ejecucion");
    }
    java.util.ArrayList<EffectRecord> updated =
        new java.util.ArrayList<>(effects);
    updated.add(effect);
    return new Execution(id, taskId, attempt, state, snapshot, retryOf,
                         knownState, cancellationRequested, updated);
  }
}
