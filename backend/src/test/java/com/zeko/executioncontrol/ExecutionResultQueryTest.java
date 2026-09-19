package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.zeko.executioncontrol.application.ExecutionRepository;
import com.zeko.executioncontrol.application.ExecutionResultQuery;
import com.zeko.executioncontrol.application.GitWorkspacePort;
import com.zeko.executioncontrol.application.WorktreeRepository;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.ExecutionSnapshot;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.projectcatalog.application.ProjectService;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.projectcatalog.domain.Repository;
import com.zeko.projectcatalog.domain.RepositoryAccessState;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ExecutionResultQueryTest {

  @TempDir
  Path localRoot;

  @Test
  void keepsSourceChangesSeparateFromWorktreeDiff() {
    ResourceId projectId = ResourceId.newId();
    ResourceId repositoryId = ResourceId.newId();
    ResourceId taskId = ResourceId.newId();
    ResourceId executionId = ResourceId.newId();
    Path repositoryPath = localRoot.resolve("repository");
    Path worktreePath = localRoot.resolve("worktree");
    Task task = new Task(taskId, projectId, repositoryId, ResourceId.newId(), ResourceId.newId(),
                         "task", Task.State.COMPLETED, "");
    Execution execution = new Execution(executionId, taskId, 1, Execution.State.COMPLETED,
                                        new ExecutionSnapshot(ResourceId.newId(), 1, "agent", Map.of()),
                                        null, "DONE", false, List.of());
    Repository repository = new Repository(repositoryId, projectId, repositoryPath, repositoryPath,
                                            RepositoryAccessState.AVAILABLE, "fingerprint");
    Project project = Project.create(projectId, "project", localRoot).attach(repository);
    Worktree worktree = new Worktree(ResourceId.newId(), repositoryId, taskId,
                                     worktreePath.toString(), worktreePath.toString(),
                                     Worktree.State.ACTIVE, executionId);
    ExecutionRepository executions = mock(ExecutionRepository.class);
    ProjectService projects = mock(ProjectService.class);
    WorktreeRepository worktrees = mock(WorktreeRepository.class);
    GitWorkspacePort git = mock(GitWorkspacePort.class);
    when(executions.findExecution(executionId)).thenReturn(Optional.of(execution));
    when(executions.findTask(taskId)).thenReturn(Optional.of(task));
    when(projects.find(projectId)).thenReturn(project);
    when(worktrees.findByTask(taskId)).thenReturn(Optional.of(worktree));
    when(git.attributableDiff(repository.gitRoot(), "HEAD")).thenReturn("previous-change");
    when(git.attributableDiff(worktreePath, "HEAD")).thenReturn("task-change");
    ExecutionResultQuery query = new ExecutionResultQuery(executions, projects, worktrees, git);

    ExecutionResultQuery.Result result = query.find(executionId);

    assertThat(result.previousChanges()).isEqualTo("previous-change");
    assertThat(result.attributableDiff()).isEqualTo("task-change");
  }
}
