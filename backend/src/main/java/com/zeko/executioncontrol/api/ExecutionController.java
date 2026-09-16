package com.zeko.executioncontrol.api;

import com.zeko.executioncontrol.application.ExecutionService;
import com.zeko.executioncontrol.application.ExecutionActivationService;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ExecutionController {
  private final ExecutionService executions;
  private final ExecutionActivationService activation;
  @Autowired
  public ExecutionController(ExecutionService executions,
                             ExecutionActivationService activation) {
    this.executions = executions;
    this.activation = activation;
  }
  public ExecutionController(ExecutionService executions) {
    this(executions, null);
  }
  @PostMapping("/tasks")
  public ResponseEntity<ExecutionDtos.TaskResponse>
  createTask(@RequestBody ExecutionDtos.TaskInput input) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ExecutionDtos.TaskResponse.from(executions.createTask(
            ResourceId.parse(input.projectId()),
            ResourceId.parse(input.repositoryId()),
            ResourceId.parse(input.agentInstanceId()),
            ResourceId.parse(input.instructionId()), input.title())));
  }
  @GetMapping("/tasks/{taskId}")
  public ExecutionDtos.TaskResponse task(@PathVariable String taskId) {
    return ExecutionDtos.TaskResponse.from(
        executions.task(ResourceId.parse(taskId)));
  }
  @PostMapping("/tasks/{taskId}/executions")
  public ResponseEntity<ExecutionDtos.Response>
  start(@PathVariable String taskId,
        @RequestBody(required = false) ExecutionDtos.RetryInput input) {
    ResourceId retry = input == null || input.retryOfExecutionId() == null
                           ? null
                           : ResourceId.parse(input.retryOfExecutionId());
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ExecutionDtos.Response.from(
            activation == null ? executions.start(ResourceId.parse(taskId), retry)
                : activation.start(ResourceId.parse(taskId), retry)));
  }
  @GetMapping("/executions/{executionId}")
  public ExecutionDtos.Response execution(@PathVariable String executionId) {
    return ExecutionDtos.Response.from(
        executions.find(ResourceId.parse(executionId)));
  }

  @GetMapping("/runtime/snapshot")
  public List<ExecutionDtos.Response> snapshot() {
    return executions.snapshot()
        .stream()
        .map(ExecutionDtos.Response::from)
        .toList();
  }

  @GetMapping("/projects/{projectId}/runtime-snapshot")
  public ExecutionDtos.RuntimeSnapshotResponse snapshot(@PathVariable String projectId) {
    return ExecutionDtos.RuntimeSnapshotResponse.from(
        executions.snapshot(ResourceId.parse(projectId)));
  }
}
