package com.zeko.executioncontrol.infrastructure;

import com.zeko.executioncontrol.application.LocalActionAdapter;
import com.zeko.executioncontrol.application.LocalActionResult;
import com.zeko.executioncontrol.application.LocalCapability;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.sharedkernel.domain.ResourceId;
import java.io.IOException;
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
    try {
      Process process = new ProcessBuilder("docker", "version", "--format",
                                           "{{.Server.Version}}")
                            .redirectErrorStream(true)
                            .start();
      boolean done = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
      if (!done || process.exitValue() != 0) {
        return LocalActionResult.unavailable("Docker local no disponible");
      }
      String output = new String(process.getInputStream().readAllBytes(),
                                 java.nio.charset.StandardCharsets.UTF_8);
      return new LocalActionResult(LocalActionResult.Status.COMPLETED,
                                   "AVAILABLE", List.of("docker"), output);
    } catch (IOException | InterruptedException unavailable) {
      Thread.currentThread().interrupt();
      return LocalActionResult.unavailable("Docker local no disponible");
    }
  }
  @Override
  public boolean cancel(ResourceId executionId) {
    return false;
  }
}
