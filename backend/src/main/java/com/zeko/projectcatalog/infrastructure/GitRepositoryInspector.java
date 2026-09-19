package com.zeko.projectcatalog.infrastructure;

import com.zeko.projectcatalog.application.RepositoryInspector;
import com.zeko.projectcatalog.domain.RepositoryAccessState;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

@Component
public class GitRepositoryInspector implements RepositoryInspector {

    private static final Duration COMMAND_TIMEOUT = Duration.ofSeconds(5);

    @Override
    public Inspection inspect(Path candidate) {
        Path normalized = candidate.toAbsolutePath().normalize();
        if (!Files.isDirectory(normalized) || !Files.isReadable(normalized)) {
            return new Inspection(normalized, null, RepositoryAccessState.UNAVAILABLE, null);
        }

        return inspectGitRoot(normalized);
    }

    private Inspection inspectGitRoot(Path normalized) {
        Process process;
        try {
            process = new ProcessBuilder(List.of("git", "-C", normalized.toString(), "rev-parse", "--show-toplevel"))
                    .redirectErrorStream(true)
                    .start();
            if (!process.waitFor(COMMAND_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                return new Inspection(normalized, null, RepositoryAccessState.INVALID, null);
            }
        } catch (IOException unavailable) {
            return new Inspection(normalized, null, RepositoryAccessState.UNAVAILABLE, null);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return new Inspection(normalized, null, RepositoryAccessState.UNAVAILABLE, null);
        }

        if (process.exitValue() != 0) {
            return new Inspection(normalized, null, RepositoryAccessState.INVALID, null);
        }
        return new Inspection(normalized, readGitRoot(process), RepositoryAccessState.AVAILABLE, null);
    }

    private static Path readGitRoot(Process process) {
        try {
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            return Path.of(output).toAbsolutePath().normalize();
        } catch (IOException unreadable) {
            throw new IllegalStateException("No se pudo leer la raiz Git", unreadable);
        }
    }
}
