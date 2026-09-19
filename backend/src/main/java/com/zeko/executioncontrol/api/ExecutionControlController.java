package com.zeko.executioncontrol.api;

import com.zeko.executioncontrol.application.CancellationService;
import com.zeko.executioncontrol.application.LocalCapability;
import com.zeko.executioncontrol.application.ManualRetryService;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ExecutionControlController {
  private final CancellationService cancellations;
  private final ManualRetryService retries;
  public ExecutionControlController(CancellationService cancellations,
                                    ManualRetryService retries) {
    this.cancellations = cancellations;
    this.retries = retries;
  }
  @PostMapping("/executions/{executionId}/cancel-requests")
  public ResponseEntity<ExecutionDtos.Response>
  request(@PathVariable String executionId) {
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ExecutionDtos.Response.from(
            cancellations.request(ResourceId.parse(executionId))));
  }
  @PostMapping("/executions/{executionId}/cancel-confirmations")
  public ExecutionDtos.Response
  confirm(@PathVariable String executionId,
          @RequestParam LocalCapability capability) {
    return ExecutionDtos.Response.from(
        cancellations.confirm(ResourceId.parse(executionId), capability));
  }
  @PostMapping("/executions/{executionId}/retries")
  public ResponseEntity<ExecutionDtos.Response>
  retry(@PathVariable String executionId) {
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ExecutionDtos.Response.from(
            retries.retry(ResourceId.parse(executionId))));
  }
}
