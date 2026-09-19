package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import java.util.Objects;

public record PermissionDecision(Outcome outcome, String reason) {

    public enum Outcome {
        ALLOWED,
        REQUIRES_APPROVAL,
        DENIED
    }

    public PermissionDecision {
        Objects.requireNonNull(outcome, "La decision requiere un resultado");
        if (reason == null || reason.isBlank()) {
            throw DomainError.validation("La decision requiere un motivo legible");
        }
        reason = reason.trim();
    }

    public boolean allowed() {
        return outcome == Outcome.ALLOWED;
    }

    public boolean requiresApproval() {
        return outcome == Outcome.REQUIRES_APPROVAL;
    }

    public boolean denied() {
        return outcome == Outcome.DENIED;
    }
}
