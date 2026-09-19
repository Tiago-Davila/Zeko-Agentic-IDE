package com.zeko.executioncontrol.api;

import com.zeko.executioncontrol.application.ExecutionResultQuery;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/executions")
public class ExecutionResultController {
  private final ExecutionResultQuery results;

  public ExecutionResultController(ExecutionResultQuery results) {
    this.results = results;
  }

  @GetMapping("/{executionId}/result")
  public Response result(@PathVariable String executionId) {
    ExecutionResultQuery.Result result =
        results.find(ResourceId.parse(executionId));
    return Response.from(result);
  }

  public record Response(String id, String taskId, String state,
                         List<ExecutionDtos.EffectResponse> effects,
                         String attributableDiff, String previousChanges) {
    static Response from(ExecutionResultQuery.Result result) {
      return new Response(result.execution().id().asString(),
                          result.execution().taskId().asString(),
                          result.execution().state().name(),
                          result.execution()
                              .effects()
                              .stream()
                              .map(ExecutionDtos.EffectResponse::from)
                              .toList(),
                          result.attributableDiff(), result.previousChanges());
    }
  }
}
