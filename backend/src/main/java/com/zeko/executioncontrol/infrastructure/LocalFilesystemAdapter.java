package com.zeko.executioncontrol.infrastructure;

import com.zeko.executioncontrol.application.LocalActionAdapter;
import com.zeko.executioncontrol.application.LocalActionResult;
import com.zeko.executioncontrol.application.LocalCapability;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class LocalFilesystemAdapter implements LocalActionAdapter {
  @Override
  public LocalCapability capability() {
    return LocalCapability.FILESYSTEM;
  }

  @Override
  public LocalActionResult execute(ActionProposal action) {
    Path root = Path.of(action.workingDirectory()).toAbsolutePath().normalize();
    Path target = root.resolve(action.resource()).normalize();
    if (!target.startsWith(root)) {
      throw DomainError.pathInvalid("La accion intenta salir del worktree");
    }
    rejectSymbolicLink(root, target);
    try {
      if ("READ_LOCAL".equals(action.type())) {
        String content = Files.exists(target) ? Files.readString(target) : "";
        return new LocalActionResult(
            LocalActionResult.Status.COMPLETED, "READ",
            List.of("read:" + target),
            content.length() > 1024 ? content.substring(0, 1024) : content);
      }
      if ("WRITE_LOCAL".equals(action.type())) {
        Files.createDirectories(target.getParent());
        String body =
            action.arguments().isEmpty() ? "" : action.arguments().get(0);
        Files.writeString(target, body);
        return new LocalActionResult(LocalActionResult.Status.COMPLETED,
                                     "WRITTEN", List.of("write:" + target),
                                     "Archivo actualizado");
      }
      return new LocalActionResult(LocalActionResult.Status.FAILED,
                                   "UNSUPPORTED", List.of(),
                                   "El adaptador no reconoce la accion");
    } catch (IOException failure) {
      return new LocalActionResult(LocalActionResult.Status.FAILED, "IO_ERROR",
                                   List.of(), failure.getMessage());
    }
  }

  @Override
  public boolean cancel(ResourceId executionId) {
    return false;
  }

  private static void rejectSymbolicLink(Path root, Path target) {
    Path cursor = root;
    Path relative = root.relativize(target);
    for (Path segment : relative) {
      cursor = cursor.resolve(segment);
      if (Files.isSymbolicLink(cursor)) {
        throw DomainError.pathInvalid("La accion no admite enlaces simbolicos");
      }
    }
  }
}
