package com.zeko.executioncontrol.api;

import com.zeko.executioncontrol.application.ConflictService;
import com.zeko.executioncontrol.domain.ConflictRecord;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks/{taskId}/conflict-resolution")
public class ConflictController {
  private final ConflictService conflicts;
  public ConflictController(ConflictService conflicts) {
    this.conflicts = conflicts;
  }
  @PostMapping
  public Response resolve(@PathVariable String taskId,
                          @RequestBody Input input) {
    ConflictRecord record = conflicts.resolve(ResourceId.parse(taskId),
                                              input.resolution(), input.note());
    return new Response(record.id().asString(), record.state().name(),
                        record.resolution());
  }
  public record Input(ConflictRecord.State resolution, String note) {}
  public record Response(String id, String state, String resolution) {}
}
