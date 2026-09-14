package com.zeko.executioncontrol.infrastructure;

import com.zeko.sharedkernel.domain.DomainError;
import java.nio.file.Path;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Component;

@Component
public class HostActionNormalizer {

    public String normalizePath(Path worktreeRoot, String candidate) {
        Objects.requireNonNull(worktreeRoot, "El worktree es obligatorio");
        if (candidate == null || candidate.isBlank()) {
            throw DomainError.pathInvalid("La ruta de accion no puede estar vacia");
        }
        Path root = worktreeRoot.toAbsolutePath().normalize();
        Path path = root.resolve(candidate).normalize();
        if (!path.startsWith(root)) {
            throw DomainError.pathInvalid("La accion intenta salir del worktree");
        }
        return path.toString();
    }

    public String normalizeWorkingDirectory(Path worktreeRoot, String candidate) {
        return normalizePath(worktreeRoot, candidate == null ? "." : candidate);
    }

    public List<String> normalizeArguments(List<String> arguments) {
        if (arguments == null) {
            return List.of();
        }
        if (arguments.stream().anyMatch(argument -> argument == null || argument.indexOf('\u0000') >= 0)) {
            throw DomainError.validation("Los argumentos contienen un caracter invalido");
        }
        return List.copyOf(arguments);
    }
}
