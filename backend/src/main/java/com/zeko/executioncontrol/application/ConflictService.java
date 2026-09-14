package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.ConflictRecord;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class ConflictService {
  private final WorktreeRepository worktrees;
  private final ExecutionRepository executions;
  public ConflictService(WorktreeRepository worktrees,
                         ExecutionRepository executions) {
    this.worktrees = worktrees;
    this.executions = executions;
  }
  public ConflictRecord resolve(ResourceId taskId,
                                ConflictRecord.State resolution, String note) {
    ConflictRecord conflict = worktrees.findConflict(taskId).orElseThrow(
        () -> DomainError.notFound("Conflict", taskId));
    ConflictRecord resolved = conflict.resolve(
        Objects.requireNonNull(resolution, "La resolucion es obligatoria"),
        note);
    if (resolution == ConflictRecord.State.CANCELLED) {
      executions.findTask(taskId).ifPresent(
          task -> executions.saveTask(task.transition(Task.State.CANCELLED)));
    }
    worktrees.saveConflict(resolved);
    return resolved;
  }
}
