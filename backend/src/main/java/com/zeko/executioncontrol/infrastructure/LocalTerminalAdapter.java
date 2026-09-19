package com.zeko.executioncontrol.infrastructure;

import com.zeko.executioncontrol.application.LocalActionAdapter;
import com.zeko.executioncontrol.application.LocalActionResult;
import com.zeko.executioncontrol.application.LocalCapability;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.sharedkernel.domain.ResourceId;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class LocalTerminalAdapter implements LocalActionAdapter {
  private final Map<ResourceId, Process> running = new ConcurrentHashMap<>();
  @Override
  public LocalCapability capability() {
    return LocalCapability.TERMINAL;
  }

  @Override
  public LocalActionResult execute(ActionProposal action) {
    if (!"EXECUTE_LOCAL".equals(action.type()) ||
        action.arguments().isEmpty()) {
      return new LocalActionResult(LocalActionResult.Status.FAILED,
                                   "INVALID_COMMAND", List.of(),
                                   "La terminal requiere un comando tipado");
    }
    List<String> command = action.arguments();
    try {
      Process process =
          new ProcessBuilder(command)
              .directory(Path.of(action.workingDirectory()).toFile())
              .redirectErrorStream(true)
              .start();
      running.put(action.executionId(), process);
      boolean finished =
          process.waitFor(Duration.ofSeconds(15).toMillis(),
                          java.util.concurrent.TimeUnit.MILLISECONDS);
      if (!finished) {
        return new LocalActionResult(LocalActionResult.Status.RUNNING,
                                     "RUNNING", List.of(),
                                     "El proceso continua activo");
      }
      String output = new String(process.getInputStream().readAllBytes(),
                                 StandardCharsets.UTF_8);
      LocalActionResult.Status status = process.exitValue() == 0
                                            ? LocalActionResult.Status.COMPLETED
                                            : LocalActionResult.Status.FAILED;
      return new LocalActionResult(status, "EXIT_" + process.exitValue(),
                                   List.of("terminal"), output);
    } catch (IOException | InterruptedException failure) {
      Thread.currentThread().interrupt();
      return new LocalActionResult(LocalActionResult.Status.FAILED,
                                   "PROCESS_ERROR", List.of(),
                                   failure.getMessage());
    } finally {
      Process current = running.get(action.executionId());
      if (current != null && !current.isAlive()) {
        running.remove(action.executionId(), current);
      }
    }
  }

  @Override
  public boolean cancel(ResourceId executionId) {
    Process process = running.get(executionId);
    if (process == null || !process.isAlive()) {
      return false;
    }
    process.destroy();
    return !process.isAlive() || process.onExit().isDone();
  }
}
