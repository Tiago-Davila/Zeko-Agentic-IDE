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
  List<Execution> findExecutionsForProject(ResourceId projectId);
  List<Task> findTasksForProject(ResourceId projectId);

  List<Execution> findAllExecutions();
  void appendEffect(EffectRecord effect);
  List<EffectRecord> effects(ResourceId executionId);
}
