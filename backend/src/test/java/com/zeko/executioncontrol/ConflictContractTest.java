package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zeko.executioncontrol.api.ConflictController;
import com.zeko.executioncontrol.application.ConflictService;
import com.zeko.executioncontrol.application.ExecutionRepository;
import com.zeko.executioncontrol.application.WorktreeRepository;
import com.zeko.executioncontrol.domain.ConflictRecord;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ConflictContractTest {

  @Test
  void exposesAConflictAndAllowsManualRecoveryAfterASecondReservationIsRejected() throws Exception {
    ResourceId repositoryId = ResourceId.newId();
    ResourceId firstTaskId = ResourceId.newId();
    ResourceId blockedTaskId = ResourceId.newId();
    ResourceId firstExecutionId = ResourceId.newId();
    String physicalPath = "/tmp/zeko-conflict-worktree";
    InMemoryWorktrees worktrees = new InMemoryWorktrees();
    worktrees.reserve(new Worktree(
        ResourceId.newId(), repositoryId, firstTaskId, physicalPath, physicalPath,
        Worktree.State.ACTIVE, firstExecutionId));
    Worktree blockedWorktree = new Worktree(
        ResourceId.newId(), repositoryId, blockedTaskId, physicalPath, physicalPath,
        Worktree.State.RESERVED, null);

    assertThatThrownBy(() -> worktrees.reserve(blockedWorktree))
        .isInstanceOfSatisfying(DomainError.class, error ->
            assertThat(error.code()).isEqualTo(DomainError.Code.CONFLICT));

    Task blocked = new Task(
        blockedTaskId, ResourceId.newId(), repositoryId, ResourceId.newId(),
        ResourceId.newId(), "Integrar cambios", Task.State.BLOCKED,
        "El worktree ya tiene un escritor");
    ExecutionRepository executions = mock(ExecutionRepository.class);
    when(executions.findTask(blockedTaskId)).thenReturn(Optional.of(blocked));
    final Task[] savedTask = new Task[1];
    doAnswer(invocation -> {
      savedTask[0] = invocation.getArgument(0);
      return null;
    }).when(executions).saveTask(org.mockito.ArgumentMatchers.any(Task.class));
    ConflictRecord open = new ConflictRecord(
        ResourceId.newId(), blockedTaskId, ConflictRecord.Type.WORKTREE_OWNERSHIP,
        List.of(physicalPath), ConflictRecord.State.OPEN, Instant.now(), "");
    worktrees.saveConflict(open);
    MockMvc mvc = MockMvcBuilders.standaloneSetup(
        new ConflictController(new ConflictService(worktrees, executions))).build();

    mvc.perform(get("/api/tasks/" + blockedTaskId + "/conflict-resolution"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.state").value("OPEN"))
        .andExpect(jsonPath("$.resources[0]").value(physicalPath));
    mvc.perform(post("/api/tasks/" + blockedTaskId + "/conflict-resolution")
            .contentType("application/json")
            .content("{\"resolution\":\"RESOLVED_MANUALLY\",\"note\":\"Cambios integrados\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.state").value("RESOLVED_MANUALLY"))
        .andExpect(jsonPath("$.resolution").value("Cambios integrados"));

    worktrees.save(worktrees.findByTask(firstTaskId).orElseThrow().release());
    assertThat(worktrees.reserve(blockedWorktree).state()).isEqualTo(Worktree.State.RESERVED);
    assertThat(savedTask[0]).isNull();
    assertThat(worktrees.findConflict(blockedTaskId)).get()
        .extracting(ConflictRecord::state)
        .isEqualTo(ConflictRecord.State.RESOLVED_MANUALLY);
  }

  @Test
  void cancellingAConflictMovesTheTaskToCancelledInsteadOfReady() throws Exception {
    ResourceId taskId = ResourceId.newId();
    Task blocked = new Task(
        taskId, ResourceId.newId(), ResourceId.newId(), ResourceId.newId(),
        ResourceId.newId(), "Cancelar conflicto", Task.State.BLOCKED, "colision");
    InMemoryWorktrees worktrees = new InMemoryWorktrees();
    ConflictRecord open = new ConflictRecord(
        ResourceId.newId(), taskId, ConflictRecord.Type.WORKTREE_OWNERSHIP,
        List.of("/tmp/blocked"), ConflictRecord.State.OPEN, Instant.now(), "");
    worktrees.saveConflict(open);
    ExecutionRepository executions = mock(ExecutionRepository.class);
    when(executions.findTask(taskId)).thenReturn(Optional.of(blocked));
    final Task[] saved = new Task[1];
    doAnswer(invocation -> {
      saved[0] = invocation.getArgument(0);
      return null;
    }).when(executions).saveTask(org.mockito.ArgumentMatchers.any(Task.class));
    MockMvc mvc = MockMvcBuilders.standaloneSetup(
        new ConflictController(new ConflictService(worktrees, executions))).build();

    mvc.perform(post("/api/tasks/" + taskId + "/conflict-resolution")
            .contentType("application/json")
            .content("{\"resolution\":\"CANCELLED\",\"note\":\"No continuar\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.state").value("CANCELLED"));

    assertThat(saved[0]).isNotNull();
    assertThat(saved[0].state()).isEqualTo(Task.State.CANCELLED);
  }

  private static final class InMemoryWorktrees implements WorktreeRepository {
    private final Map<ResourceId, Worktree> worktrees = new java.util.HashMap<>();
    private final Map<ResourceId, ConflictRecord> conflicts = new java.util.HashMap<>();

    @Override
    public Worktree reserve(Worktree worktree) {
      Optional<Worktree> occupied = worktrees.values().stream()
          .filter(current -> current.physicalPath().equals(worktree.physicalPath()))
          .filter(current -> current.state() != Worktree.State.RELEASED)
          .findFirst();
      if (occupied.isPresent()) {
        throw DomainError.conflict("El worktree ya tiene un escritor");
      }
      worktrees.put(worktree.id(), worktree);
      return worktree;
    }

    @Override
    public Optional<Worktree> findByTask(ResourceId taskId) {
      return worktrees.values().stream()
          .filter(worktree -> worktree.taskId().equals(taskId)).findFirst();
    }

    @Override
    public Optional<Worktree> findByPhysicalPath(String physicalPath) {
      return worktrees.values().stream()
          .filter(worktree -> worktree.physicalPath().equals(physicalPath))
          .filter(worktree -> worktree.state() != Worktree.State.RELEASED)
          .findFirst();
    }

    @Override
    public void save(Worktree worktree) {
      worktrees.put(worktree.id(), worktree);
    }

    @Override
    public void saveConflict(ConflictRecord conflict) {
      conflicts.put(conflict.taskId(), conflict);
    }

    @Override
    public Optional<ConflictRecord> findConflict(ResourceId taskId) {
      return Optional.ofNullable(conflicts.get(taskId));
    }
  }
}
