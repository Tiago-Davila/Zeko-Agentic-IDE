package com.zeko.projectcatalog.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public record Project(ResourceId id, String name, Path rootPath, List<Repository> repositories) {

    public Project {
        Objects.requireNonNull(id, "El proyecto requiere un identificador");
        name = requireName(name);
        rootPath = requireRoot(rootPath);
        repositories = List.copyOf(repositories == null ? List.of() : repositories);
        validateRepositories(id, repositories);
    }

    public static Project create(ResourceId id, String name, Path rootPath) {
        return new Project(id, name, rootPath, List.of());
    }

    public Project attach(Repository repository) {
        Objects.requireNonNull(repository, "El repositorio es obligatorio");
        if (!id.equals(repository.projectId())) {
            throw DomainError.validation("El repositorio no pertenece al proyecto");
        }
        if (repositories.stream().anyMatch(existing -> existing.normalizedPath().equals(repository.normalizedPath()))) {
            throw DomainError.conflict("La ruta de repositorio ya pertenece al proyecto");
        }

        List<Repository> updated = new ArrayList<>(repositories);
        updated.add(repository);
        return new Project(id, name, rootPath, updated);
    }

    private static String requireName(String value) {
        if (value == null || value.isBlank()) {
            throw DomainError.validation("El proyecto requiere un nombre");
        }
        return value.trim();
    }

    private static Path requireRoot(Path value) {
        if (value == null) {
            throw DomainError.validation("El proyecto requiere una raiz local");
        }
        return value.toAbsolutePath().normalize();
    }

    private static void validateRepositories(ResourceId projectId, List<Repository> repositories) {
        Set<Path> paths = new HashSet<>();
        for (Repository repository : repositories) {
            if (repository == null || !projectId.equals(repository.projectId())) {
                throw DomainError.validation("Cada repositorio debe pertenecer al proyecto");
            }
            if (!paths.add(repository.normalizedPath())) {
                throw DomainError.conflict("La ruta de repositorio ya pertenece al proyecto");
            }
        }
    }
}
