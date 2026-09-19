package com.zeko.executioncontrol.infrastructure;

import com.zeko.executioncontrol.application.AuthorizedCommitService.CommitPort;
import com.zeko.sharedkernel.domain.DomainError;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class GitCommitAdapter implements CommitPort {
  @Override
  public String commit(Path worktree, String message) {
    return run(List.of("git", "-C",
                       worktree.toAbsolutePath().normalize().toString(),
                       "commit", "-m", message),
               worktree);
  }
  private static String run(List<String> command, Path worktree) {
    try {
      Process process = new ProcessBuilder(command)
                            .directory(worktree.toFile())
                            .redirectErrorStream(true)
                            .start();
      process.waitFor(20, java.util.concurrent.TimeUnit.SECONDS);
      String result = new String(process.getInputStream().readAllBytes(),
                                 StandardCharsets.UTF_8);
      if (process.exitValue() != 0) {
        throw DomainError.conflict("Git no pudo crear el commit: " + result);
      }
      return result;
    } catch (IOException | InterruptedException failure) {
      Thread.currentThread().interrupt();
      throw DomainError.providerUnavailable("Git local no disponible");
    }
  }
}
