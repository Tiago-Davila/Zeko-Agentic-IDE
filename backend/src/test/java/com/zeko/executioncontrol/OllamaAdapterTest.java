package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.application.LocalActionResult;
import com.zeko.executioncontrol.application.LocalModelPort;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.executioncontrol.infrastructure.LocalOllamaAdapter;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class OllamaAdapterTest {

  @Test
  void recordsLocalGenerationAsAnExecutionEffect() {
    LocalModelPort model = (name, prompt) -> new LocalModelPort.Generation(
        LocalModelPort.Generation.Status.COMPLETED, "respuesta", "FINAL");
    LocalOllamaAdapter adapter = new LocalOllamaAdapter(model);
    ActionProposal action = new ActionProposal(
        ResourceId.newId(), ResourceId.newId(), null, ResourceId.newId(), "READ_LOCAL",
        "ollama:local", "worktree", ".", List.of("responde"), "", Set.of("model"),
        PermissionPolicy.ActionCategory.READ_LOCAL, 1);

    assertThat(adapter.execute(action).status()).isEqualTo(LocalActionResult.Status.COMPLETED);
  }
}
