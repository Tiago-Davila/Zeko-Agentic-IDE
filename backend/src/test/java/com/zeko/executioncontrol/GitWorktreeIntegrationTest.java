package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.infrastructure.GitWorktreeAdapter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class GitWorktreeIntegrationTest {

  @TempDir
  Path root;

  @Test
  void createsAnIsolatedWorktreeAndRedactsSecretsFromItsDiff() throws Exception {
    Path repository = root.resolve("repository");
    Files.createDirectories(repository);
    git(repository, "init", "--quiet", "--initial-branch=main");
    git(repository, "config", "user.name", "Zeko test");
    git(repository, "config", "user.email", "zeko-test@localhost");
    Files.writeString(repository.resolve("README.md"), "base\n");
    git(repository, "add", "README.md");
    git(repository, "commit", "--quiet", "-m", "chore: initial state");

    Path worktree = root.resolve("worktrees").resolve("task-1");
    GitWorktreeAdapter adapter = new GitWorktreeAdapter();
    assertThat(adapter.createWorktree(repository, worktree, "HEAD"))
        .isEqualTo(worktree.toAbsolutePath().normalize());
    Files.writeString(worktree.resolve("README.md"), "token=super-secret-value\n");

    String diff = adapter.attributableDiff(worktree, "HEAD");

    assertThat(Files.isDirectory(worktree)).isTrue();
    assertThat(diff).contains("token=[REDACTED]").doesNotContain("super-secret-value");
  }

  private static void git(Path directory, String... arguments) throws Exception {
    List<String> command = new ArrayList<>();
    command.add("git");
    command.addAll(Arrays.asList(arguments));
    Process process = new ProcessBuilder(command)
        .directory(directory.toFile())
        .redirectErrorStream(true)
        .start();
    boolean completed = process.waitFor(20, TimeUnit.SECONDS);
    String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    if (!completed || process.exitValue() != 0) {
      throw new AssertionError("Git fixture failed: " + output);
    }
  }
}
