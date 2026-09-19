package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;

public record ApprovalDecision(Decision decision, int actionRevision, ResourceId decidedBy, String reason) {

    public enum Decision {
        APPROVE,
        DENY
    }

    public ApprovalDecision {
        Objects.requireNonNull(decision, "La decision de aprobacion es obligatoria");
        Objects.requireNonNull(decidedBy, "La aprobacion requiere quien decide");
        if (actionRevision < 1) {
            throw DomainError.validation("La revision de aprobacion debe ser positiva");
        }
        reason = reason == null ? "" : reason.trim();
    }
}
