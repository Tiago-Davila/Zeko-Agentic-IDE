package com.zeko.agentdesign.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.Objects;

public record SkillDefinition(
        ResourceId id, ResourceId projectId, String name, Path skillPath, String fingerprint, Scope scope) {

    public enum Scope {
        PROJECT,
        GLOBAL
    }

    public SkillDefinition {
        Objects.requireNonNull(id, "La skill requiere un identificador");
        Objects.requireNonNull(projectId, "La skill requiere un proyecto");
        name = requireText(name, "un nombre");
        skillPath = requirePath(skillPath);
        fingerprint = requireText(fingerprint, "una huella");
        Objects.requireNonNull(scope, "La skill requiere un alcance");
    }

    public SkillDefinition promoteToGlobal() {
        return new SkillDefinition(id, projectId, name, skillPath, fingerprint, Scope.GLOBAL);
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw DomainError.validation("La skill requiere " + field);
        }
        return value.trim();
    }

    private static Path requirePath(Path value) {
        if (value == null || value.getFileName() == null || !"SKILL.md".equals(value.getFileName().toString())) {
            throw DomainError.validation("La skill debe referenciar un archivo SKILL.md");
        }
        return value.normalize();
    }
}
