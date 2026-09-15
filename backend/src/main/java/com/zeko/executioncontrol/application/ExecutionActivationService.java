package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.ConflictRecord;
import com.zeko.executioncontrol.domain.EffectRecord;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.projectcatalog.application.ProjectService;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.projectcatalog.domain.Repository;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class ExecutionActivationService {
  private final ExecutionService executions;
  private final ExecutionRepository executionRepository;
  private final ProjectService projects;
  private final WorktreeRepository worktrees;
  private final GitWorkspacePort git;
  private final AuthorizedActionDispatcher dispatcher;

  public ExecutionActivationService(ExecutionService executions,
                                    ExecutionRepository executionRepository,
                                    ProjectService projects,
                                    WorktreeRepository worktrees,
                                    GitWorkspacePort git,
                                    AuthorizedActionDispatcher dispatcher) {
    this.executions = Objects.requireNonNull(executions);
    this.executionRepository = Objects.requireNonNull(executionRepository);
    this.projects = Objects.requireNonNull(projects);
    this.worktrees = Objects.requireNonNull(worktrees);
    this.git = Objects.requireNonNull(git);
    this.dispatcher = Objects.requireNonNull(dispatcher);
  }

  public Execution start(ResourceId taskId, ResourceId retryOf) {
    Task task = executions.task(taskId);
    Repository repository = repository(task);
    if (repository.gitRoot() == null) {
      throw DomainError.providerUnavailable(
          "El repositorio Git local no esta disponible");
    }
    Execution pending = executions.start(taskId, retryOf);
    Path repositoryRoot = repository.gitRoot();
    Path worktreePath = worktreePath(repositoryRoot, task, pending);
    Worktree reserved = new Worktree(ResourceId.newId(), repository.id(), task.id(),
                                     worktreePath.toString(), worktreePath.toString(),
                                     Worktree.State.RESERVED, null);
    Worktree stored = null;
    try {
      stored = worktrees.reserve(reserved);
      git.createWorktree(repositoryRoot, worktreePath, "HEAD");
      Worktree active = stored.activate(pending.id());
      worktrees.save(active);
      Execution running = pending.transition(Execution.State.RUNNING, "WORKTREE_READY");
      executionRepository.saveExecution(running);
      return running;
    } catch (DomainError failure) {
      recoverFailure(task, pending, worktreePath, stored, failure);
      throw failure;
    }
  }

  public LocalActionResult dispatch(ActionProposal action, ResourceId approvalId,
                                    ResourceId taskId) {
    Objects.requireNonNull(action, "La accion es obligatoria");
    Execution current = executions.find(action.executionId());
    if (!current.taskId().equals(taskId)) {
      throw DomainError.validation("La accion no pertenece a la task indicada");
    }
    if (current.state() != Execution.State.RUNNING
        && current.state() != Execution.State.WAITING_APPROVAL) {
      throw DomainError.blocked("La ejecucion no esta activa");
    }
    Task task = executions.task(taskId);
    LocalActionResult result = dispatcher.dispatch(action, approvalId, taskId);
    List<String> descriptions = result.effects().isEmpty()
        ? List.of(action.resource()) : result.effects();
    Execution updated = current;
    int sequence = current.effects().size() + 1;
    boolean confirmed = result.status() == LocalActionResult.Status.COMPLETED;
    for (String description : descriptions) {
      EffectRecord effect = new EffectRecord(ResourceId.newId(), current.id(), sequence++, action.type(),
                                             description, confirmed, result.safeOutput());
      executionRepository.appendEffect(effect);
      updated = updated.record(effect);
    }
    Execution.State next = stateFor(result.status(), current);
    updated = updated.transition(next, result.knownState());
    executionRepository.saveExecution(updated);
    if (next != Execution.State.RUNNING
        && next != Execution.State.WAITING_APPROVAL) {
      executionRepository.saveTask(task.transition(taskStateFor(next)));
    }
    return result;
  }

  private Repository repository(Task task) {
    Project project = projects.find(task.projectId());
    return project.repositories().stream()
        .filter(candidate -> candidate.id().equals(task.repositoryId()))
        .findFirst()
        .orElseThrow(() -> DomainError.notFound("Repository", task.repositoryId()));
  }

  private static Path worktreePath(Path repositoryRoot, Task task, Execution execution) {
    return repositoryRoot.resolveSibling(".zeko-worktrees")
        .resolve(task.id().asString() + "-attempt-" + execution.attempt())
        .toAbsolutePath().normalize();
  }

  private void recoverFailure(Task task, Execution pending, Path worktreePath, Worktree stored,
                              DomainError failure) {
    if (stored != null && stored.state() == Worktree.State.RESERVED) {
      worktrees.save(stored.release());
    }
    if (failure.code() == DomainError.Code.CONFLICT || failure.code() == DomainError.Code.BLOCKED) {
      executionRepository.saveTask(task.block(failure.getMessage()));
      worktrees.saveConflict(new ConflictRecord(ResourceId.newId(), task.id(),
                                                ConflictRecord.Type.WORKTREE_OWNERSHIP,
                                                List.of(worktreePath.toString()), ConflictRecord.State.OPEN,
                                                Instant.now(), ""));
      return;
    }
    executionRepository.saveTask(task.transition(Task.State.FAILED));
    executionRepository.saveExecution(pending.transition(Execution.State.FAILED, failure.getMessage()));
  }

  private static Execution.State stateFor(LocalActionResult.Status status, Execution current) {
    return switch (status) {
      case COMPLETED -> Execution.State.COMPLETED;
      case RUNNING -> Execution.State.RUNNING;
      case CANCELLED -> current.cancellationRequested()
          ? Execution.State.CANCELLED : Execution.State.FAILED;
      case FAILED, UNAVAILABLE -> Execution.State.FAILED;
    };
  }

  private static Task.State taskStateFor(Execution.State state) {
    return switch (state) {
      case COMPLETED -> Task.State.COMPLETED;
      case CANCELLED -> Task.State.CANCELLED;
      case FAILED -> Task.State.FAILED;
      default -> Task.State.RUNNING;
    };
  }
}
