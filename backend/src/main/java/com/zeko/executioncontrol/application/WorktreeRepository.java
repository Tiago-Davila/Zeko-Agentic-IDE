package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.ConflictRecord;
import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Optional;

public interface WorktreeRepository {
  Worktree reserve(Worktree worktree);
  Optional<Worktree> findByTask(ResourceId taskId);
  Optional<Worktree> findByPhysicalPath(String physicalPath);
  void save(Worktree worktree);
  void saveConflict(ConflictRecord conflict);
  Optional<ConflictRecord> findConflict(ResourceId taskId);
}
