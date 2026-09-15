package com.zeko.executioncontrol.infrastructure;

import com.zeko.executioncontrol.application.GitWorkspacePort;
import com.zeko.sharedkernel.domain.DomainError;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class GitWorktreeAdapter implements GitWorkspacePort {
  @Override
  public Path createWorktree(Path repository, Path destination,
                             String revision) {
    Path repo = repository.toAbsolutePath().normalize();
    Path target = destination.toAbsolutePath().normalize();
    if (!Files.isDirectory(repo) || !Files.exists(repo.resolve(".git"))) {
      throw DomainError.pathInvalid("El repositorio Git local no es valido");
    }
    if (Files.exists(target)) {
      throw DomainError.conflict("El destino de worktree ya existe");
    }
    try {
      Files.createDirectories(target.getParent());
    } catch (IOException failure) {
      throw DomainError.pathInvalid(
          "No se pudo preparar el directorio del worktree local");
    }
    List<String> command =
        List.of("git", "-C", repo.toString(), "worktree", "add", "--detach",
                target.toString(),
                revision == null || revision.isBlank() ? "HEAD" : revision);
    run(command, repo);
    return target;
  }

  @Override
  public String attributableDiff(Path worktree, String baselineRevision) {
    Path root = worktree.toAbsolutePath().normalize();
    String baseline = baselineRevision == null || baselineRevision.isBlank()
                          ? "HEAD"
                          : baselineRevision;
    return redact(run(List.of("git", "-C", root.toString(), "diff", "--no-ext-diff",
                              baseline, "--"), root));
  }

  private static String redact(String diff) {
    return diff.replaceAll("(?is)(token|password|secret|authorization)=[^\\s]+",
                           "$1=[REDACTED]");
  }

  private static String run(List<String> command, Path directory) {
    try {
      Process process = new ProcessBuilder(command)
                            .directory(directory.toFile())
                            .redirectErrorStream(true)
                            .start();
      boolean completed =
          process.waitFor(20, java.util.concurrent.TimeUnit.SECONDS);
      String output = new String(process.getInputStream().readAllBytes(),
                                 StandardCharsets.UTF_8);
      if (!completed || process.exitValue() != 0) {
        throw DomainError.conflict("Git local rechazo la operacion: " + output);
      }
      return output;
    } catch (IOException | InterruptedException failure) {
      Thread.currentThread().interrupt();
      throw DomainError.providerUnavailable("Git local no esta disponible");
    }
  }
}
