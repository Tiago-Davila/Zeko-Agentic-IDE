package com.zeko.executioncontrol.infrastructure;

import com.zeko.sharedkernel.domain.DomainError;
import java.nio.file.Path;
import org.springframework.stereotype.Component;

@Component
public class GitDiffReader {
  private final GitWorktreeAdapter git;
  public GitDiffReader(GitWorktreeAdapter git) {
    this.git = git;
  }
  public String readAttributable(Path worktree, String baseline) {
    String diff = git.attributableDiff(worktree, baseline);
    if (diff.toLowerCase(java.util.Locale.ROOT).contains("password=") ||
        diff.toLowerCase(java.util.Locale.ROOT).contains("token=")) {
      return diff.replaceAll("(?i)(password|token|secret)=[^\\s]+",
                             "$1=[REDACTED]");
    }
    return diff;
  }
  public String separatePreviousChanges(String attributable, String previous) {
    if (previous == null || previous.isBlank()) {
      return attributable;
    }
    if (attributable == null) {
      throw DomainError.validation("El diff atribuible es obligatorio");
    }
    return attributable;
  }
}
