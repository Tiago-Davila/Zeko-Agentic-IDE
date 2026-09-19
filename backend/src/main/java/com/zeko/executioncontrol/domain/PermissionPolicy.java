package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

public record PermissionPolicy(
        ResourceId id,
        ResourceId runtimeSettingsId,
        PermissionMode mode,
        Set<String> autoApproveRules,
        Set<String> constitutionalProhibitions) {

    public enum ActionCategory {
        READ_LOCAL,
        WRITE_LOCAL,
        EXECUTE_LOCAL,
        NETWORK,
        DESTRUCTIVE,
        PROHIBITED
    }

    public PermissionPolicy {
        Objects.requireNonNull(id, "La politica requiere un identificador");
        Objects.requireNonNull(runtimeSettingsId, "La politica requiere runtime settings");
        Objects.requireNonNull(mode, "La politica requiere un modo");
        autoApproveRules = immutableRules(autoApproveRules);
        constitutionalProhibitions = immutableRules(constitutionalProhibitions);
    }

    public PermissionPolicy(ResourceId runtimeSettingsId, PermissionMode mode, Set<String> autoApproveRules) {
        this(ResourceId.newId(), runtimeSettingsId, mode, autoApproveRules, Set.of());
    }

    public PermissionDecision evaluate(
            ActionCategory category,
            boolean local,
            boolean destructive,
            boolean network,
            boolean constitutionallyProhibited,
            boolean previouslyDenied) {

        Objects.requireNonNull(category, "La categoria de accion es obligatoria");
        if (constitutionallyProhibited || category == ActionCategory.PROHIBITED
                || constitutionalProhibitions.contains("*")
                || constitutionalProhibitions.contains(category.name())) {
            return new PermissionDecision(PermissionDecision.Outcome.DENIED,
                    "La accion esta prohibida por las reglas constitucionales");
        }
        if (previouslyDenied) {
            return new PermissionDecision(PermissionDecision.Outcome.DENIED,
                    "La accion fue denegada previamente y requiere una nueva propuesta");
        }
        if (mode == PermissionMode.FULL_ACCESS) {
            return new PermissionDecision(PermissionDecision.Outcome.ALLOWED,
                    "Full Access permite la accion dentro de los limites constitucionales");
        }
        boolean mutative = destructive || network || category == ActionCategory.WRITE_LOCAL
                || category == ActionCategory.EXECUTE_LOCAL;
        if (mode == PermissionMode.ASK_APPROVAL && mutative) {
            return new PermissionDecision(PermissionDecision.Outcome.REQUIRES_APPROVAL,
                    "La accion mutante, de red o destructiva requiere aprobacion");
        }
        if (mode == PermissionMode.AUTO_APPROVE && local && !mutative && explicitlyCovered(category)) {
            return new PermissionDecision(PermissionDecision.Outcome.ALLOWED,
                    "La regla local no destructiva esta expresamente cubierta");
        }
        if (mode == PermissionMode.AUTO_APPROVE) {
            return new PermissionDecision(PermissionDecision.Outcome.REQUIRES_APPROVAL,
                    "La accion local no esta cubierta por una regla segura de auto-aprobacion");
        }
        return new PermissionDecision(PermissionDecision.Outcome.ALLOWED,
                "La lectura local no mutante esta permitida");
    }

    public PermissionDecision evaluate(ActionCategory category, boolean local, boolean destructive, boolean network) {
        return evaluate(category, local, destructive, network, false, false);
    }

    public PermissionDecision evaluate(ActionProposal action) {
        Objects.requireNonNull(action, "La accion es obligatoria");
        boolean network = action.classification() == ActionCategory.NETWORK
                || !action.networkTarget().isBlank();
        boolean destructive = action.classification() == ActionCategory.DESTRUCTIVE;
        return evaluate(action.classification(), !network, destructive, network, false, false);
    }

    public PermissionDecision evaluate(ActionProposal action, boolean constitutionallyProhibited,
            boolean previouslyDenied) {
        Objects.requireNonNull(action, "La accion es obligatoria");
        boolean network = action.classification() == ActionCategory.NETWORK
                || !action.networkTarget().isBlank();
        boolean destructive = action.classification() == ActionCategory.DESTRUCTIVE;
        return evaluate(action.classification(), !network, destructive, network,
                constitutionallyProhibited, previouslyDenied);
    }

    private boolean explicitlyCovered(ActionCategory category) {
        return autoApproveRules.contains(category.name()) || autoApproveRules.contains("*");
    }

    private static Set<String> immutableRules(Set<String> rules) {
        if (rules == null) {
            return Set.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String rule : rules) {
            if (rule == null || rule.isBlank()) {
                throw DomainError.validation("Las reglas de permiso no pueden estar vacias");
            }
            normalized.add(rule.trim());
        }
        return Set.copyOf(normalized);
    }
}
