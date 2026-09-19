package com.zeko.traceability.api;

import com.zeko.sharedkernel.domain.ResourceId;
import com.zeko.traceability.application.TraceRecorder;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/traces")
public class TraceQueryController {
  private final TraceRecorder traces;

  public TraceQueryController(TraceRecorder traces) {
    this.traces = traces;
  }

  @GetMapping("/{resourceId}")
  public List<Response> find(@PathVariable String resourceId) {
    return traces.findByResource(ResourceId.parse(resourceId))
        .stream()
        .map(Response::from)
        .toList();
  }

  public record Response(String sourceId, String targetId, String relation,
                         Map<String, String> detail) {
    static Response from(
        com.zeko.traceability.application.TraceRepository.RecordedTrace trace) {
      return new Response(trace.link().sourceId().asString(),
                          trace.link().targetId().asString(),
                          trace.link().relation(), trace.detail().values());
    }
  }
}
