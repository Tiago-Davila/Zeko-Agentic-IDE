package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class ActionClassifier {

    private static final Pattern URL = Pattern.compile("https?://[^\\s]+", Pattern.CASE_INSENSITIVE);
    private static final Set<String> CLOSED_TYPES = Set.of("READ_LOCAL", "WRITE_LOCAL", "EXECUTE_LOCAL", "NETWORK");

    public ClassifiedAction classify(Request request) {
        Objects.requireNonNull(request, "La solicitud de accion es obligatoria");
        String type = text(request.type(), "tipo").toUpperCase(Locale.ROOT);
        if (!CLOSED_TYPES.contains(type)) {
            throw DomainError.forbidden("El tipo de accion no pertenece al catalogo local");
        }
        String resource = text(request.resource(), "recurso");
        String scope = text(request.scope(), "alcance");
        String cwd = text(request.workingDirectory(), "directorio de trabajo");
        List<String> arguments = request.arguments() == null ? List.of() : List.copyOf(request.arguments());
        if (arguments.stream().anyMatch(argument -> argument == null || argument.contains("\u0000"))) {
            throw DomainError.validation("Los argumentos contienen un valor invalido");
        }
        String networkTarget = request.networkTarget() == null ? "" : request.networkTarget().trim();
        boolean network = "NETWORK".equals(type) || !networkTarget.isBlank()
                || effectsContain(request.expectedEffects(), "network");
        if (network && !URL.matcher(networkTarget).matches()) {
            throw DomainError.validation("El destino de red debe ser una URL HTTP localmente declarada");
        }
        boolean composite = request.expectedEffects() != null && request.expectedEffects().size() > 1;
        boolean onlyReads = request.expectedEffects() == null || request.expectedEffects().stream()
                .allMatch(effect -> effect != null && effect.toLowerCase(Locale.ROOT).contains("read"));
        boolean destructive = "WRITE_LOCAL".equals(type) || effectsContainDestructive(request.expectedEffects())
                || composite && !onlyReads;
        PermissionPolicy.ActionCategory category = category(type, network, destructive);
        ActionProposal proposal = new ActionProposal(
                request.id() == null ? ResourceId.newId() : request.id(),
                request.executionId(), request.agentInstanceId(), request.taskId(), type, resource, scope, cwd,
                arguments, networkTarget, request.expectedEffects(), category, request.revision());
        boolean prohibited = category == PermissionPolicy.ActionCategory.PROHIBITED;
        return new ClassifiedAction(proposal, !network, destructive, network, prohibited);
    }

    private static PermissionPolicy.ActionCategory category(String type, boolean network, boolean destructive) {
        if (destructive) {
            return PermissionPolicy.ActionCategory.DESTRUCTIVE;
        }
        if (network) {
            return PermissionPolicy.ActionCategory.NETWORK;
        }
        return PermissionPolicy.ActionCategory.valueOf(type);
    }

    private static boolean effectsContainDestructive(Set<String> effects) {
        return effectsContain(effects, "delete") || effectsContain(effects, "destroy")
                || effectsContain(effects, "remove") || effectsContain(effects, "write");
    }

    private static boolean effectsContain(Set<String> effects, String token) {
        if (effects == null) {
            return false;
        }
        return effects.stream().map(effect -> effect == null ? "" : effect.toLowerCase(Locale.ROOT))
                .anyMatch(effect -> effect.contains(token));
    }

    private static String text(String value, String field) {
        if (value == null || value.isBlank()) {
            throw DomainError.validation("La accion requiere " + field);
        }
        return value.trim();
    }

    public record Request(
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
            int revision) {

        public Request {
            Objects.requireNonNull(executionId, "La accion requiere una ejecucion");
            if (revision < 1) {
                throw DomainError.validation("La revision de accion debe ser positiva");
            }
        }
    }

    public record ClassifiedAction(
            ActionProposal proposal,
            boolean local,
            boolean destructive,
            boolean network,
            boolean prohibited) {
    }
}
