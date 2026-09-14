package com.zeko.executioncontrol.application;

import com.zeko.agentdesign.application.AgentService;
import com.zeko.agentdesign.domain.AgentInstance;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.ExecutionSnapshot;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ExecutionService {
  private final ExecutionRepository executions;
  private final AgentService agents;
  public ExecutionService(ExecutionRepository executions, AgentService agents) {
    this.executions = executions;
    this.agents = agents;
  }
  public Task createTask(ResourceId projectId, ResourceId repositoryId,
                         ResourceId agentId, ResourceId instructionId,
                         String title) {
    Task task = new Task(ResourceId.newId(), projectId, repositoryId, agentId,
                         instructionId, title, Task.State.READY, "");
    executions.saveTask(task);
    return task;
  }
  public Execution start(ResourceId taskId, ResourceId retryOf) {
    Task task = task(taskId);
    if (task.state() == Task.State.BLOCKED) {
      throw DomainError.blocked("La task sigue bloqueada");
    }
    List<Execution> previous = executions.findExecutions(taskId);
    if (retryOf != null && previous.stream().noneMatch(
                               execution -> execution.id().equals(retryOf))) {
      throw DomainError.validation("El reintento no pertenece a la task");
    }
    AgentInstance agent = agents.instance(task.agentInstanceId());
    ExecutionSnapshot snapshot = new ExecutionSnapshot(
        agent.templateId(), agent.selectedTemplateVersion(), agent.identity(),
        agent.context());
    Execution execution =
        new Execution(ResourceId.newId(), taskId, previous.size() + 1,
                      Execution.State.PENDING, snapshot, retryOf, "PENDING",
                      false, List.of());
    executions.saveExecution(execution);
    executions.saveTask(task.transition(Task.State.RUNNING));
    return execution;
  }
  public Execution find(ResourceId executionId) {
    return executions.findExecution(executionId)
        .orElseThrow(() -> DomainError.notFound("Execution", executionId));
  }
  public Task task(ResourceId taskId) {
    return executions.findTask(taskId).orElseThrow(
        () -> DomainError.notFound("Task", taskId));
  }

  public List<Execution> snapshot() {
    return executions.findAllExecutions();
  }
}
