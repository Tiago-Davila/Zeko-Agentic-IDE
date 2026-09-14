package com.zeko.coordination.application;

import com.zeko.coordination.domain.AutonomyMode;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class AgentLoop {
  private final ModelGateway model;
  private final ExecutionGateway executions;

  public AgentLoop(ModelGateway model, ExecutionGateway executions) {
    this.model = model;
    this.executions = executions;
  }

  public String respond(ResourceId conversationId, ResourceId instructionId,
                        String instruction, AutonomyMode mode) {
    if (mode == AutonomyMode.MANUAL && instruction.startsWith("follow-up:")) {
      throw DomainError.forbidden("El modo manual no inicia follow-ups");
    }
    String response = model.generate(instruction);
    executions.report(
        conversationId,
        mode == AutonomyMode.ASSISTED ? "CONFIRMATION_REQUIRED" : "REPORTED",
        Objects.requireNonNull(instructionId, "La instruccion es obligatoria"));
    return response;
  }

  public interface ModelGateway {
    String generate(String prompt);
  }
}
