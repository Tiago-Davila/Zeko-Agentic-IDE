package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.zeko.executioncontrol.application.AuthorizedActionDispatcher;
import com.zeko.executioncontrol.application.ExecutionActivationService;
import com.zeko.executioncontrol.application.ExecutionRepository;
import com.zeko.executioncontrol.application.ExecutionService;
import com.zeko.executioncontrol.application.GitWorkspacePort;
import com.zeko.executioncontrol.application.LocalActionResult;
import com.zeko.executioncontrol.application.WorktreeRepository;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.ExecutionSnapshot;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.projectcatalog.application.ProjectService;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.projectcatalog.domain.Repository;
import com.zeko.projectcatalog.domain.RepositoryAccessState;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ExecutionActivationServiceTest {

  @TempDir
  Path localRoot;

  @Test
  void reservesWorktreeBeforeMarkingExecutionRunning() {
    ResourceId projectId = ResourceId.newId();
    ResourceId repositoryId = ResourceId.newId();
    ResourceId taskId = ResourceId.newId();
    ResourceId executionId = ResourceId.newId();
    Path repositoryPath = localRoot.resolve("repository");
    Task task = task(taskId, projectId, repositoryId);
    Execution pending = execution(executionId, taskId, Execution.State.PENDING);
    Project project = Project.create(projectId, "project", localRoot).attach(
        new Repository(repositoryId, projectId, repositoryPath, repositoryPath,
                       RepositoryAccessState.AVAILABLE, "fingerprint"));
    ExecutionService executions = mock(ExecutionService.class);
    ExecutionRepository executionRepository = mock(ExecutionRepository.class);
    ProjectService projects = mock(ProjectService.class);
    WorktreeRepository worktrees = mock(WorktreeRepository.class);
    GitWorkspacePort git = mock(GitWorkspacePort.class);
    AuthorizedActionDispatcher dispatcher = mock(AuthorizedActionDispatcher.class);
    when(executions.start(taskId, null)).thenReturn(pending);
    when(executions.task(taskId)).thenReturn(task);
    when(projects.find(projectId)).thenReturn(project);
    when(worktrees.reserve(any(Worktree.class))).thenAnswer(invocation -> invocation.getArgument(0));
    when(git.createWorktree(any(Path.class), any(Path.class), any(String.class)))
        .thenAnswer(invocation -> invocation.getArgument(1));
    ExecutionActivationService activation = new ExecutionActivationService(
        executions, executionRepository, projects, worktrees, git, dispatcher);

    Execution running = activation.start(taskId, null);

    assertThat(running.state()).isEqualTo(Execution.State.RUNNING);
    verify(worktrees).reserve(any(Worktree.class));
    verify(git).createWorktree(repositoryPath, runningWorktree(repositoryPath, task, pending), "HEAD");
    verify(worktrees).save(any(Worktree.class));
    verify(executionRepository).saveExecution(running);
  }

  @Test
  void recordsAdapterEffectsAndFinalStateAfterAuthorization() {
    ResourceId taskId = ResourceId.newId();
    ResourceId executionId = ResourceId.newId();
    ResourceId approvalId = ResourceId.newId();
    Execution current = execution(executionId, taskId, Execution.State.RUNNING);
    Task task = new Task(taskId, ResourceId.newId(), ResourceId.newId(),
                         ResourceId.newId(), ResourceId.newId(), "task",
                         Task.State.RUNNING, "");
    ExecutionService executions = mock(ExecutionService.class);
    ExecutionRepository executionRepository = mock(ExecutionRepository.class);
    AuthorizedActionDispatcher dispatcher = mock(AuthorizedActionDispatcher.class);
    when(executions.find(executionId)).thenReturn(current);
    when(executions.task(taskId)).thenReturn(task);
    when(dispatcher.dispatch(any(ActionProposal.class), any(ResourceId.class), any(ResourceId.class)))
        .thenReturn(new LocalActionResult(LocalActionResult.Status.COMPLETED, "DONE",
                                          List.of("write:file"), "archivo actualizado"));
    ExecutionActivationService activation = new ExecutionActivationService(
        executions, executionRepository, mock(ProjectService.class), mock(WorktreeRepository.class),
        mock(GitWorkspacePort.class), dispatcher);
    ActionProposal action = new ActionProposal(
        ResourceId.newId(), executionId, null, taskId, "READ_LOCAL", "file.txt", "worktree", ".",
        List.of(), "", Set.of("lectura"), PermissionPolicy.ActionCategory.READ_LOCAL, 1);

    LocalActionResult result = activation.dispatch(action, approvalId, taskId);

    assertThat(result.status()).isEqualTo(LocalActionResult.Status.COMPLETED);
    verify(dispatcher).dispatch(action, approvalId, taskId);
    verify(executionRepository).appendEffect(any());
    verify(executionRepository).saveExecution(any(Execution.class));
    verify(executionRepository).saveTask(any(Task.class));
  }

  @Test
  void rejectsExecutionWhenTheRepositoryHasNoLocalGitRoot() {
    ResourceId projectId = ResourceId.newId();
    ResourceId repositoryId = ResourceId.newId();
    ResourceId taskId = ResourceId.newId();
    Path repositoryPath = localRoot.resolve("missing-repository");
    Task task = task(taskId, projectId, repositoryId);
    Project project = Project.create(projectId, "project", localRoot).attach(
        new Repository(repositoryId, projectId, repositoryPath, null,
                       RepositoryAccessState.UNAVAILABLE, null));
    ExecutionService executions = mock(ExecutionService.class);
    ProjectService projects = mock(ProjectService.class);
    when(executions.task(taskId)).thenReturn(task);
    when(projects.find(projectId)).thenReturn(project);
    ExecutionActivationService activation = new ExecutionActivationService(
        executions, mock(ExecutionRepository.class), projects,
        mock(WorktreeRepository.class), mock(GitWorkspacePort.class),
        mock(AuthorizedActionDispatcher.class));

    assertThatThrownBy(() -> activation.start(taskId, null))
        .isInstanceOf(DomainError.class)
        .hasMessageContaining("repositorio Git local");
    verify(executions, never()).start(taskId, null);
  }

  private static Task task(ResourceId taskId, ResourceId projectId, ResourceId repositoryId) {
    return new Task(taskId, projectId, repositoryId, ResourceId.newId(), ResourceId.newId(),
                    "task", Task.State.READY, "");
  }

  private static Execution execution(ResourceId executionId, ResourceId taskId, Execution.State state) {
    return new Execution(executionId, taskId, 1, state,
                         new ExecutionSnapshot(ResourceId.newId(), 1, "agent", Map.of()),
                         null, state.name(), false, List.of());
  }

  private static Path runningWorktree(Path repositoryPath, Task task, Execution execution) {
    return repositoryPath.resolveSibling(".zeko-worktrees")
        .resolve(task.id().asString() + "-attempt-" + execution.attempt())
        .toAbsolutePath().normalize();
  }
}
