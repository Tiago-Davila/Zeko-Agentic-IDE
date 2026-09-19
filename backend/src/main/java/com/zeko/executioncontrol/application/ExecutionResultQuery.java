package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.projectcatalog.application.ProjectService;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.projectcatalog.domain.Repository;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import org.springframework.stereotype.Service;

@Service
public class ExecutionResultQuery {
  private final ExecutionRepository executions;
  private final ProjectService projects;
  private final WorktreeRepository worktrees;
  private final GitWorkspacePort git;

  public ExecutionResultQuery(ExecutionRepository executions, ProjectService projects,
                              WorktreeRepository worktrees,
                              GitWorkspacePort git) {
    this.executions = executions;
    this.projects = projects;
    this.worktrees = worktrees;
    this.git = git;
  }

  public Result find(ResourceId executionId) {
    Execution execution =
        executions.findExecution(executionId)
            .orElseThrow(() -> DomainError.notFound("Execution", executionId));
    Task task = executions.findTask(execution.taskId())
        .orElseThrow(() -> DomainError.notFound("Task", execution.taskId()));
    Project project = projects.find(task.projectId());
    Repository repository = project.repositories().stream()
        .filter(candidate -> candidate.id().equals(task.repositoryId()))
        .findFirst()
        .orElseThrow(() -> DomainError.notFound("Repository", task.repositoryId()));
    String previous = repository.gitRoot() == null
        ? "" : git.attributableDiff(repository.gitRoot(), "HEAD");
    String attributable = worktrees.findByTask(task.id())
        .map(worktree -> git.attributableDiff(Path.of(worktree.physicalPath()), "HEAD"))
        .orElse("");
    return new Result(execution, attributable, previous);
  }

  public record Result(Execution execution, String attributableDiff,
                       String previousChanges) {}
}
