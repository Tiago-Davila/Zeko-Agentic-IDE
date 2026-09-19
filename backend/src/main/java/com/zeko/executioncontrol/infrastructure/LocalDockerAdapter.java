package com.zeko.executioncontrol.infrastructure;

import com.zeko.executioncontrol.application.LocalActionAdapter;
import com.zeko.executioncontrol.application.LocalActionResult;
import com.zeko.executioncontrol.application.LocalCapability;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.sharedkernel.domain.ResourceId;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class LocalDockerAdapter implements LocalActionAdapter {
  @Override
  public LocalCapability capability() {
    return LocalCapability.DOCKER;
  }
  @Override
  public LocalActionResult execute(ActionProposal action) {
    String host = System.getenv("DOCKER_HOST");
    if (host != null && !host.isBlank() && !host.contains("localhost") &&
        !host.contains("127.0.0.1")) {
      return LocalActionResult.unavailable("Docker remoto no esta permitido");
    }
    if (action.arguments().isEmpty()) {
      return new LocalActionResult(LocalActionResult.Status.FAILED, "INVALID_DOCKER_ACTION",
                                   List.of(), "Docker requiere un comando tipado");
    }
    if (action.arguments().stream().anyMatch(LocalDockerAdapter::isRemoteTarget)) {
      return LocalActionResult.unavailable("Docker remoto no esta permitido");
    }
    try {
      List<String> command = new ArrayList<>();
      command.add("docker");
      command.addAll(action.arguments());
      Process process = new ProcessBuilder(command)
                            .directory(java.nio.file.Path.of(action.workingDirectory()).toFile())
                            .redirectErrorStream(true)
                            .start();
      boolean done = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
      if (!done) {
        process.destroyForcibly();
        return new LocalActionResult(LocalActionResult.Status.FAILED, "TIMEOUT", List.of("docker"),
                                     "Docker local excedio el tiempo limite");
      }
      String output = new String(process.getInputStream().readAllBytes(),
                                 java.nio.charset.StandardCharsets.UTF_8);
      if (process.exitValue() != 0) {
        return new LocalActionResult(LocalActionResult.Status.FAILED, "EXIT_" + process.exitValue(),
                                     List.of("docker"), output);
      }
      return new LocalActionResult(LocalActionResult.Status.COMPLETED,
                                   "EXIT_0", List.of("docker"), output);
    } catch (IOException | InterruptedException unavailable) {
      Thread.currentThread().interrupt();
      return LocalActionResult.unavailable("Docker local no disponible");
    }
  }
  @Override
  public boolean cancel(ResourceId executionId) {
    return false;
  }

  private static boolean isRemoteTarget(String argument) {
    String value = argument.toLowerCase(java.util.Locale.ROOT);
    return value.equals("-h") || value.equals("--host") || value.startsWith("--host=")
        || value.startsWith("tcp://")
        || value.startsWith("ssh://") || value.startsWith("http://") || value.startsWith("https://");
  }
}
