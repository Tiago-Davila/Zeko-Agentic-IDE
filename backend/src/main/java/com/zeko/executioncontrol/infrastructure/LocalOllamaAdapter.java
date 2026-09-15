package com.zeko.executioncontrol.infrastructure;

import com.zeko.executioncontrol.application.LocalActionAdapter;
import com.zeko.executioncontrol.application.LocalActionResult;
import com.zeko.executioncontrol.application.LocalCapability;
import com.zeko.executioncontrol.application.LocalModelPort;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class LocalOllamaAdapter implements LocalActionAdapter {
  private final LocalModelPort models;

  public LocalOllamaAdapter(LocalModelPort models) {
    this.models = models;
  }

  @Override
  public LocalCapability capability() {
    return LocalCapability.OLLAMA;
  }

  @Override
  public LocalActionResult execute(ActionProposal action) {
    String model = action.resource().startsWith("ollama:")
        ? action.resource().substring("ollama:".length()) : "local";
    String prompt = String.join(" ", action.arguments()).trim();
    if (model.isBlank() || prompt.isBlank()) {
      return new LocalActionResult(LocalActionResult.Status.FAILED, "INVALID_PROMPT",
                                   List.of(), "Ollama requiere modelo y prompt");
    }
    LocalModelPort.Generation generation = models.generate(model, prompt);
    LocalActionResult.Status status = switch (generation.status()) {
      case COMPLETED -> LocalActionResult.Status.COMPLETED;
      case STREAMING -> LocalActionResult.Status.RUNNING;
      case FAILED -> LocalActionResult.Status.FAILED;
      case UNAVAILABLE -> LocalActionResult.Status.UNAVAILABLE;
    };
    return new LocalActionResult(status, generation.detail(), List.of("ollama:" + model), generation.text());
  }

  @Override
  public boolean cancel(ResourceId executionId) {
    return false;
  }
}
