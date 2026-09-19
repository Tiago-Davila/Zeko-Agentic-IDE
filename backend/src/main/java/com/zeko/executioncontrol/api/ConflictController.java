package com.zeko.executioncontrol.api;

import com.zeko.executioncontrol.application.ConflictService;
import com.zeko.executioncontrol.domain.ConflictRecord;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
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
  @GetMapping
  public Response get(@PathVariable String taskId) {
    ConflictRecord record = conflicts.view(ResourceId.parse(taskId));
    return response(record);
  }
  @PostMapping
  public Response resolve(@PathVariable String taskId,
                          @RequestBody Input input) {
    ConflictRecord record = conflicts.resolve(ResourceId.parse(taskId),
                                              input.resolution(), input.note());
    return response(record);
  }
  private static Response response(ConflictRecord record) {
    return new Response(record.id().asString(), record.taskId().asString(), record.type().name(),
                        record.resources(), record.state().name(), record.resolution());
  }
  public record Input(ConflictRecord.State resolution, String note) {}
  public record Response(String id, String taskId, String type, List<String> resources,
                         String state, String resolution) {}
}
