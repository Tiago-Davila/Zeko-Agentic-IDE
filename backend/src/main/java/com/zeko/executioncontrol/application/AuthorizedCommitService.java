package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.CommitMessagePolicy;
import com.zeko.sharedkernel.domain.DomainError;
import java.nio.file.Path;
import org.springframework.stereotype.Service;

@Service
public class AuthorizedCommitService {
  private final CommitMessagePolicy policy = new CommitMessagePolicy();
  private final CommitPort git;
  public AuthorizedCommitService(CommitPort git) {
    this.git = git;
  }
  public String commit(Path worktree, String message, boolean authorized,
                       boolean checksPassed, String attributableDiff) {
    if (!authorized || !checksPassed || attributableDiff == null ||
        attributableDiff.isBlank()) {
      throw DomainError.forbidden(
          "El commit requiere accion autorizada, checks y diff atribuible");
    }
    policy.validate(message);
    return git.commit(worktree, message);
  }

  public interface CommitPort {
    String commit(Path worktree, String message);
  }
}
