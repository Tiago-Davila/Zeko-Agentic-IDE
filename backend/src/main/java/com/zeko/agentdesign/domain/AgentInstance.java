package com.zeko.agentdesign.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public record AgentInstance(
        ResourceId id,
        ResourceId projectId,
        ResourceId templateId,
        int selectedTemplateVersion,
        String identity,
        Map<String, String> context,
        String state) {

    public AgentInstance {
        Objects.requireNonNull(id, "La instancia requiere un identificador");
        Objects.requireNonNull(projectId, "La instancia requiere un proyecto");
        Objects.requireNonNull(templateId, "La instancia requiere una plantilla");
        if (selectedTemplateVersion < 1) {
            throw DomainError.validation("La instancia requiere una version de plantilla positiva");
        }
        identity = requireText(identity, "una identidad");
        context = immutableContext(context);
        state = requireText(state, "un estado");
    }

    public AgentInstance selectTemplateVersion(int version) {
        if (version < 1) {
            throw DomainError.validation("La instancia requiere una version de plantilla positiva");
        }
        return new AgentInstance(id, projectId, templateId, version, identity, context, state);
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw DomainError.validation("La instancia requiere " + field);
        }
        return value.trim();
    }

    private static Map<String, String> immutableContext(Map<String, String> source) {
        if (source == null) {
            throw DomainError.validation("El contexto de instancia es obligatorio");
        }
        Map<String, String> copy = new LinkedHashMap<>();
        source.forEach((key, value) -> {
            if (key == null || key.isBlank() || value == null) {
                throw DomainError.validation("El contexto de instancia requiere claves y valores validos");
            }
            copy.put(key, value);
        });
        return Map.copyOf(copy);
    }
}
