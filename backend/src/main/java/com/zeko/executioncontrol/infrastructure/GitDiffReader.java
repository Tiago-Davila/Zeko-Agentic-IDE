package com.zeko.executioncontrol.infrastructure;

import com.zeko.executioncontrol.application.GitWorkspacePort;
import com.zeko.sharedkernel.domain.DomainError;
import java.nio.file.Path;
import org.springframework.stereotype.Component;

@Component
public class GitDiffReader {
  private final GitWorkspacePort git;
  public GitDiffReader(GitWorkspacePort git) {
    this.git = git;
  }
  public String readAttributable(Path worktree, String baseline) {
    String diff = git.attributableDiff(worktree, baseline);
    return diff.replaceAll("(?is)(password|token|secret|authorization)=[^\\s]+",
                           "$1=[REDACTED]");
  }
  public String separatePreviousChanges(String attributable, String previous) {
    if (previous == null || previous.isBlank()) {
      return "";
    }
    if (attributable == null) {
      throw DomainError.validation("El diff atribuible es obligatorio");
    }
    return previous;
  }
}
