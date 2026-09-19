package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.zeko.executioncontrol.application.ApprovalRepository;
import com.zeko.executioncontrol.application.AuthorizedActionDispatcher;
import com.zeko.executioncontrol.application.CapabilityRegistry;
import com.zeko.executioncontrol.application.ExecutionActivationService;
import com.zeko.executioncontrol.application.ExecutionRepository;
import com.zeko.executioncontrol.application.ExecutionService;
import com.zeko.executioncontrol.application.GitWorkspacePort;
import com.zeko.executioncontrol.application.LocalActionResult;
import com.zeko.executioncontrol.application.PermissionPolicyService;
import com.zeko.executioncontrol.application.WorktreeRepository;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.Approval;
import com.zeko.executioncontrol.domain.EffectRecord;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.ExecutionSnapshot;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.executioncontrol.infrastructure.LocalFilesystemAdapter;
import com.zeko.projectcatalog.application.ProjectService;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AuthorizedActionDispatcherIntegrationTest {

  @TempDir
  Path worktree;

  @Test
  void authorizedWriteCreatesAnEffectAndCompletesTheExecution() throws Exception {
    Scenario scenario = scenario(Approval.State.APPROVED, "allowed.txt", "contenido autorizado");

    LocalActionResult result = scenario.activation().dispatch(
        scenario.action(), scenario.approvalId(), scenario.task().id());

    assertThat(result.status()).isEqualTo(LocalActionResult.Status.COMPLETED);
    assertThat(Files.readString(worktree.resolve("allowed.txt")))
        .isEqualTo("contenido autorizado");
    assertThat(scenario.repository().effects()).singleElement()
        .satisfies(effect -> {
          assertThat(effect.confirmed()).isTrue();
          assertThat(effect.resource()).contains("allowed.txt");
        });
    assertThat(scenario.repository().savedExecution().state())
        .isEqualTo(Execution.State.COMPLETED);
    assertThat(scenario.repository().savedTask().state())
        .isEqualTo(Task.State.COMPLETED);
  }

  @Test
  void deniedApprovalDoesNotTouchTheAdapterOrPersistAnEffect() {
    Scenario scenario = scenario(Approval.State.DENIED, "denied.txt", "no debe escribirse");

    assertThatThrownBy(() -> scenario.activation().dispatch(
        scenario.action(), scenario.approvalId(), scenario.task().id()))
        .isInstanceOfSatisfying(DomainError.class, error ->
            assertThat(error.code()).isEqualTo(DomainError.Code.APPROVAL_STALE));

    assertThat(Files.exists(worktree.resolve("denied.txt"))).isFalse();
    assertThat(scenario.repository().effects()).isEmpty();
    assertThat(scenario.repository().savedExecution()).isNull();
    assertThat(scenario.repository().savedTask()).isNull();
  }

  private Scenario scenario(Approval.State approvalState, String resource, String content) {
    ResourceId taskId = ResourceId.newId();
    ResourceId executionId = ResourceId.newId();
    ResourceId approvalId = ResourceId.newId();
    Execution execution = new Execution(
        executionId, taskId, 1, Execution.State.RUNNING,
        new ExecutionSnapshot(ResourceId.newId(), 1, "agent", Map.of()), null,
        "RUNNING", false, List.of());
    Task task = new Task(
        taskId, ResourceId.newId(), ResourceId.newId(), ResourceId.newId(),
        ResourceId.newId(), "local write", Task.State.RUNNING, "");
    Worktree worktreeState = new Worktree(
        ResourceId.newId(), task.repositoryId(), task.id(), worktree.toString(),
        worktree.toString(), Worktree.State.ACTIVE, executionId);
    ActionProposal action = new ActionProposal(
        ResourceId.newId(), executionId, null, taskId, "WRITE_LOCAL", resource,
        "worktree", worktree.toString(), List.of(content), "", Set.of("write:" + resource),
        PermissionPolicy.ActionCategory.WRITE_LOCAL, 1);
    Approval approval = new Approval(
        approvalId, action.id(), action.revision(), approvalState, ResourceId.newId(),
        Instant.now(), approvalState.name(), 1);

    ApprovalRepository approvals = mock(ApprovalRepository.class);
    when(approvals.findApproval(approvalId)).thenReturn(Optional.of(approval));
    WorktreeRepository worktrees = mock(WorktreeRepository.class);
    when(worktrees.findByTask(taskId)).thenReturn(Optional.of(worktreeState));
    AuthorizedActionDispatcher dispatcher = new AuthorizedActionDispatcher(
        approvals, mock(PermissionPolicyService.class), worktrees,
        new CapabilityRegistry(List.of(new LocalFilesystemAdapter())));
    CapturingExecutionRepository repository = new CapturingExecutionRepository();
    ExecutionService executions = mock(ExecutionService.class);
    when(executions.find(executionId)).thenReturn(execution);
    when(executions.task(taskId)).thenReturn(task);
    ExecutionActivationService activation = new ExecutionActivationService(
        executions, repository, mock(ProjectService.class), worktrees,
        mock(GitWorkspacePort.class), dispatcher);
    return new Scenario(activation, action, approvalId, task, repository);
  }

  private record Scenario(ExecutionActivationService activation, ActionProposal action,
                          ResourceId approvalId, Task task,
                          CapturingExecutionRepository repository) {
  }

  private static final class CapturingExecutionRepository implements ExecutionRepository {
    private final List<EffectRecord> effects = new java.util.ArrayList<>();
    private Execution savedExecution;
    private Task savedTask;

    @Override
    public void saveTask(Task task) {
      savedTask = task;
    }

    @Override
    public Optional<Task> findTask(ResourceId taskId) {
      return Optional.ofNullable(savedTask);
    }

    @Override
    public void saveExecution(Execution execution) {
      savedExecution = execution;
    }

    @Override
    public Optional<Execution> findExecution(ResourceId executionId) {
      return Optional.ofNullable(savedExecution);
    }

    @Override
    public List<Execution> findExecutions(ResourceId taskId) {
      return savedExecution == null ? List.of() : List.of(savedExecution);
    }

    @Override
    public List<Execution> findAllExecutions() {
      return savedExecution == null ? List.of() : List.of(savedExecution);
    }

    @Override
    public List<Execution> findAllExecutions(ResourceId projectId) {
      return findAllExecutions();
    }

    @Override
    public List<Task> findTasks(ResourceId projectId) {
      return savedTask == null ? List.of() : List.of(savedTask);
    }

    @Override
    public void appendEffect(EffectRecord effect) {
      effects.add(effect);
    }

    private List<EffectRecord> effects() {
      return List.copyOf(effects);
    }

    private Execution savedExecution() {
      return savedExecution;
    }

    private Task savedTask() {
      return savedTask;
    }

    @Override
    public List<EffectRecord> effects(ResourceId executionId) {
      return List.copyOf(effects);
    }
  }
}
