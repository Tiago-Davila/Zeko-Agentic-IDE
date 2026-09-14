package com.zeko.agentdesign.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.Objects;

public record TemplateUpdateDecision(
        ResourceId id,
        ResourceId instanceId,
        int previousTemplateVersion,
        int proposedTemplateVersion,
        Outcome outcome,
        Instant decidedAt) {

    public enum Outcome {
        ACCEPTED,
        REJECTED
    }

    public TemplateUpdateDecision {
        Objects.requireNonNull(id, "La decision de actualizacion requiere un identificador");
        Objects.requireNonNull(instanceId, "La decision de actualizacion requiere una instancia");
        if (previousTemplateVersion < 1 || proposedTemplateVersion < 1) {
            throw DomainError.validation("Las versiones de actualizacion deben ser positivas");
        }
        if (previousTemplateVersion == proposedTemplateVersion) {
            throw DomainError.validation("La actualizacion debe proponer una version distinta");
        }
        Objects.requireNonNull(outcome, "La decision de actualizacion requiere un resultado");
        Objects.requireNonNull(decidedAt, "La decision de actualizacion requiere fecha");
    }

    public boolean appliesToFutureExecutions() {
        return outcome == Outcome.ACCEPTED;
    }
}
