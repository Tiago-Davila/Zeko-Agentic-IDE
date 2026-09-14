package com.zeko.projectcatalog.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.Objects;

public record Repository(
        ResourceId id,
        ResourceId projectId,
        Path normalizedPath,
        Path gitRoot,
        RepositoryAccessState accessState,
        String fingerprint) {

    public Repository {
        Objects.requireNonNull(id, "El repositorio requiere un identificador");
        Objects.requireNonNull(projectId, "El repositorio requiere un proyecto");
        normalizedPath = normalize(normalizedPath, "ruta");
        accessState = Objects.requireNonNull(accessState, "El repositorio requiere un estado de acceso");
        gitRoot = gitRoot == null ? null : normalize(gitRoot, "raiz Git");
        fingerprint = fingerprint == null ? null : requireText(fingerprint, "huella");

        if (accessState == RepositoryAccessState.AVAILABLE && gitRoot == null) {
            throw DomainError.validation("Un repositorio disponible requiere una raiz Git");
        }
    }

    public Repository withAccessState(RepositoryAccessState newState, Path newGitRoot, String newFingerprint) {
        return new Repository(id, projectId, normalizedPath, newGitRoot, newState, newFingerprint);
    }

    private static Path normalize(Path path, String field) {
        if (path == null) {
            throw DomainError.validation("El repositorio requiere " + field);
        }
        return path.toAbsolutePath().normalize();
    }

    private static String requireText(String value, String field) {
        if (value.isBlank()) {
            throw DomainError.validation("El repositorio requiere " + field);
        }
        return value.trim();
    }
}
