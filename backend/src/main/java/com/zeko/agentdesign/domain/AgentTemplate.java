package com.zeko.agentdesign.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public record AgentTemplate(ResourceId id, ResourceId projectId, String name, List<TemplateVersion> versions) {

    public AgentTemplate {
        Objects.requireNonNull(id, "La plantilla requiere un identificador");
        Objects.requireNonNull(projectId, "La plantilla requiere un proyecto");
        name = requireName(name);
        versions = List.copyOf(versions == null ? List.of() : versions);
        validateVersions(id, versions);
    }

    public TemplateVersion currentVersion() {
        if (versions.isEmpty()) {
            throw DomainError.conflict("La plantilla no tiene ninguna version");
        }
        return versions.getLast();
    }

    public TemplateVersion version(int number) {
        return versions.stream()
                .filter(candidate -> candidate.number() == number)
                .findFirst()
                .orElseThrow(() -> DomainError.validation("La version no pertenece a la plantilla"));
    }

    public AgentTemplate append(TemplateVersion nextVersion) {
        Objects.requireNonNull(nextVersion, "La siguiente version es obligatoria");
        if (!id.equals(nextVersion.templateId())) {
            throw DomainError.validation("La version no pertenece a la plantilla");
        }
        if (nextVersion.number() != versions.size() + 1) {
            throw DomainError.conflict("La version de plantilla debe ser consecutiva");
        }

        List<TemplateVersion> updated = new ArrayList<>(versions);
        updated.add(nextVersion);
        return new AgentTemplate(id, projectId, name, updated);
    }

    private static String requireName(String value) {
        if (value == null || value.isBlank()) {
            throw DomainError.validation("La plantilla requiere un nombre");
        }
        return value.trim();
    }

    private static void validateVersions(ResourceId templateId, List<TemplateVersion> versions) {
        for (int index = 0; index < versions.size(); index++) {
            TemplateVersion version = versions.get(index);
            if (version == null || !templateId.equals(version.templateId())) {
                throw DomainError.validation("Cada version debe pertenecer a la plantilla");
            }
            if (version.number() != index + 1) {
                throw DomainError.conflict("Las versiones de plantilla deben ser consecutivas");
            }
        }
    }
}
