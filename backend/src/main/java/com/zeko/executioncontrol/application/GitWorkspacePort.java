package com.zeko.executioncontrol.application;

import java.nio.file.Path;

public interface GitWorkspacePort {
  Path createWorktree(Path repository, Path destination, String revision);
  String attributableDiff(Path worktree, String baselineRevision);
}
