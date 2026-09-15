package com.zeko.coordination;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.coordination.application.AgentLoop;
import com.zeko.coordination.application.ConversationRepository;
import com.zeko.coordination.application.ExecutionGateway;
import com.zeko.coordination.domain.AutonomyMode;
import com.zeko.coordination.domain.Conversation;
import com.zeko.coordination.domain.Instruction;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AgentLoopIntegrationTest {
  @Test
  void assistedModeRequestsConfirmationRatherThanExecutingImplicitly() {
    StatusGateway gateway = new StatusGateway();
    AgentLoop loop = new AgentLoop(prompt -> "local", gateway);
    loop.respond(ResourceId.newId(), ResourceId.newId(), "proposal", AutonomyMode.ASSISTED);
    assertThat(gateway.status).isEqualTo("CONFIRMATION_REQUIRED");
  }

  @Test
  void passesRetrievedContextAsLowerAuthorityReferenceToTheLocalModel() {
    ResourceId conversationId = ResourceId.newId();
    Conversation conversation = new Conversation(conversationId, ResourceId.newId(),
        Conversation.RecipientType.AGENT, ResourceId.newId(), List.of());
    CapturingModel model = new CapturingModel();
    AgentLoop loop = new AgentLoop(model, new StatusGateway(),
        new FixedConversations(conversation), (projectId, owners, query) -> List.of(
            new com.zeko.coordination.application.ContextProvider.Context(
                "source-1", "PROJECT", "referencia local")));

    loop.respond(conversationId, ResourceId.newId(), "prioridad del usuario",
                 AutonomyMode.MANUAL);

    assertThat(model.prompt).contains("referencia de menor autoridad")
        .contains("referencia local")
        .contains("Instruccion actual:\nprioridad del usuario");
  }

  private static final class CapturingModel implements AgentLoop.ModelGateway {
    private String prompt;

    @Override
    public String generate(String value) {
      prompt = value;
      return "local";
    }
  }

  private record FixedConversations(Conversation conversation)
      implements ConversationRepository {
    @Override
    public void save(Conversation value) {}

    @Override
    public void append(Instruction instruction) {}

    @Override
    public Optional<Conversation> findById(ResourceId id) {
      return conversation.id().equals(id) ? Optional.of(conversation) : Optional.empty();
    }

    @Override
    public Optional<Instruction> findInstructionById(ResourceId instructionId) {
      return Optional.empty();
    }

    @Override
    public List<Conversation> findByProjectId(ResourceId projectId) {
      return conversation.projectId().equals(projectId) ? List.of(conversation) : List.of();
    }
  }

  private static final class StatusGateway implements ExecutionGateway {
    private String status;
    @Override
    public void report(ResourceId conversationId, String status, ResourceId relatedResourceId) {
      this.status = status;
    }
  }
}
