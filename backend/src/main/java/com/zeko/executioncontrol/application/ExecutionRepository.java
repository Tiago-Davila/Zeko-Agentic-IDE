package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.EffectRecord;
import com.zeko.executioncontrol.domain.Execution;
import com.zeko.executioncontrol.domain.Task;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Optional;

public interface ExecutionRepository {
  void saveTask(Task task);
  Optional<Task> findTask(ResourceId taskId);
  void saveExecution(Execution execution);
  Optional<Execution> findExecution(ResourceId executionId);
  List<Execution> findExecutions(ResourceId taskId);
  default List<Execution> findExecutionsForProject(ResourceId projectId) {
    return findAllExecutions(projectId);
  }
  default List<Task> findTasksForProject(ResourceId projectId) {
    return findTasks(projectId);
  }

  List<Execution> findAllExecutions();
  List<Execution> findAllExecutions(ResourceId projectId);
  List<Task> findTasks(ResourceId projectId);
  void appendEffect(EffectRecord effect);
  List<EffectRecord> effects(ResourceId executionId);
}
