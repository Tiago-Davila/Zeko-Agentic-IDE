package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public record ActionProposal(
        ResourceId id,
        ResourceId executionId,
        ResourceId agentInstanceId,
        ResourceId taskId,
        String type,
        String resource,
        String scope,
        String workingDirectory,
        List<String> arguments,
        String networkTarget,
        Set<String> expectedEffects,
        PermissionPolicy.ActionCategory classification,
        int revision) {

    public ActionProposal {
        Objects.requireNonNull(id, "La accion requiere un identificador");
        Objects.requireNonNull(executionId, "La accion requiere una ejecucion");
        type = text(type, "tipo");
        resource = text(resource, "recurso");
        scope = text(scope, "alcance");
        workingDirectory = text(workingDirectory, "directorio de trabajo");
        arguments = safeArguments(arguments);
        networkTarget = safeNetworkTarget(networkTarget);
        expectedEffects = immutableEffects(expectedEffects);
        Objects.requireNonNull(classification, "La accion requiere una clasificacion");
        if (revision < 1) {
            throw DomainError.validation("La revision de accion debe ser positiva");
        }
    }

    public ActionProposal(
            ResourceId id,
            ResourceId executionId,
            String type,
            String resource,
            String scope,
            Set<String> expectedEffects,
            int revision) {
        this(id, executionId, null, null, type, resource, scope, ".", List.of(), "", expectedEffects,
                PermissionPolicy.ActionCategory.READ_LOCAL, revision);
    }

    public ActionProposal revise(
            String revisedType,
            String revisedResource,
            String revisedScope,
            String revisedWorkingDirectory,
            List<String> revisedArguments,
            String revisedNetworkTarget,
            Set<String> revisedEffects,
            PermissionPolicy.ActionCategory revisedClassification) {
        return new ActionProposal(id, executionId, agentInstanceId, taskId, revisedType, revisedResource, revisedScope,
                revisedWorkingDirectory, revisedArguments, revisedNetworkTarget, revisedEffects,
                revisedClassification, revision + 1);
    }

    public ActionProposal revise(String revisedResource, String revisedScope, Set<String> revisedEffects) {
        return revise(type, revisedResource, revisedScope, workingDirectory, arguments, networkTarget, revisedEffects,
                classification);
    }

    public boolean sameRevision(int candidate) {
        return revision == candidate;
    }

    private static String text(String value, String field) {
        if (value == null || value.isBlank()) {
            throw DomainError.validation("La accion requiere " + field);
        }
        return value.trim();
    }

    private static Set<String> immutableEffects(Set<String> effects) {
        if (effects == null) {
            return Set.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String effect : effects) {
            if (effect == null || effect.isBlank()) {
                throw DomainError.validation("Los efectos esperados no pueden estar vacios");
            }
            normalized.add(effect.trim());
        }
        return Set.copyOf(normalized);
    }

    private static List<String> safeArguments(List<String> source) {
        if (source == null) {
            return List.of();
        }
        List<String> copy = new java.util.ArrayList<>();
        boolean redactNext = false;
        for (String argument : source) {
            if (argument == null || argument.indexOf('\u0000') >= 0) {
                throw DomainError.validation("Los argumentos contienen un valor invalido");
            }
            String normalized = argument.trim();
            String lower = normalized.toLowerCase(java.util.Locale.ROOT);
            if (redactNext) {
                copy.add("[REDACTED]");
                redactNext = false;
            } else {
                copy.add(normalized);
                redactNext = lower.equals("--token") || lower.equals("--password")
                        || lower.equals("--secret") || lower.equals("--authorization");
            }
        }
        return List.copyOf(copy);
    }

    private static String safeNetworkTarget(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.trim();
        int query = normalized.indexOf('?');
        return query < 0 ? normalized : normalized.substring(0, query);
    }
}
