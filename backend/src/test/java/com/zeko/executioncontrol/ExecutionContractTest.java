package com.zeko.executioncontrol;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zeko.executioncontrol.api.ExecutionController;
import com.zeko.executioncontrol.application.ExecutionActivationService;
import com.zeko.executioncontrol.application.ExecutionService;
import com.zeko.executioncontrol.domain.EffectRecord;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.ExecutionSnapshot;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ExecutionContractTest {

  @Test
  void createsATaskAndReturnsTheExecutionStateAndEffects() throws Exception {
    ResourceId projectId = ResourceId.newId();
    ResourceId repositoryId = ResourceId.newId();
    ResourceId agentId = ResourceId.newId();
    ResourceId instructionId = ResourceId.newId();
    ResourceId taskId = ResourceId.newId();
    ResourceId executionId = ResourceId.newId();
    Task task = new Task(taskId, projectId, repositoryId, agentId, instructionId,
                         "Implementar", Task.State.READY, "");
    Execution execution = execution(executionId, taskId);
    ExecutionService executions = mock(ExecutionService.class);
    ExecutionActivationService activation = mock(ExecutionActivationService.class);
    when(executions.createTask(projectId, repositoryId, agentId, instructionId, "Implementar"))
        .thenReturn(task);
    when(activation.start(taskId, null)).thenReturn(execution);
    MockMvc mvc = MockMvcBuilders.standaloneSetup(
        new ExecutionController(executions, activation)).build();

    mvc.perform(post("/api/tasks")
            .contentType("application/json")
            .content("{\"projectId\":\"" + projectId
                + "\",\"repositoryId\":\"" + repositoryId
                + "\",\"agentInstanceId\":\"" + agentId
                + "\",\"instructionId\":\"" + instructionId
                + "\",\"title\":\"Implementar\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(taskId.asString()))
        .andExpect(jsonPath("$.state").value("READY"));
    mvc.perform(post("/api/tasks/" + taskId + "/executions"))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.id").value(executionId.asString()))
        .andExpect(jsonPath("$.state").value("RUNNING"))
        .andExpect(jsonPath("$.effects[0].confirmed").value(true))
        .andExpect(jsonPath("$.effects[0].detail").value("Archivo actualizado"));

    verify(activation).start(taskId, null);
  }

  @Test
  void returnsOnlyTheRequestedProjectRuntimeSnapshot() throws Exception {
    ResourceId projectId = ResourceId.newId();
    ResourceId taskId = ResourceId.newId();
    Execution execution = execution(ResourceId.newId(), taskId);
    Task task = new Task(taskId, projectId, ResourceId.newId(), ResourceId.newId(),
                         ResourceId.newId(), "Runtime", Task.State.RUNNING, "");
    ExecutionService executions = mock(ExecutionService.class);
    when(executions.snapshot(projectId)).thenReturn(
        new ExecutionService.RuntimeSnapshot(projectId, List.of(execution), List.of(task)));
    MockMvc mvc = MockMvcBuilders.standaloneSetup(
        new ExecutionController(executions, mock(ExecutionActivationService.class))).build();

    mvc.perform(get("/api/projects/" + projectId + "/runtime-snapshot"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.projectId").value(projectId.asString()))
        .andExpect(jsonPath("$.executions[0].taskId").value(taskId.asString()))
        .andExpect(jsonPath("$.tasks[0].id").value(taskId.asString()));
  }

  private static Execution execution(ResourceId executionId, ResourceId taskId) {
    EffectRecord effect = new EffectRecord(
        ResourceId.newId(), executionId, 1, "WRITE_LOCAL", "note.txt", true,
        "Archivo actualizado");
    return new Execution(
        executionId, taskId, 1, Execution.State.RUNNING,
        new ExecutionSnapshot(ResourceId.newId(), 2, "planner", Map.of("scope", "local")),
        null, "RUNNING", false, List.of(effect));
  }
}
