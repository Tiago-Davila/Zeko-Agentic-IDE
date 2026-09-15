package com.zeko.coordination;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.coordination.application.AgentLoop;
import com.zeko.coordination.application.ConversationRepository;
import com.zeko.coordination.application.ConversationService;
import com.zeko.coordination.domain.Conversation;
import com.zeko.coordination.domain.Instruction;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ConversationServiceTest {
  @Test
  void persistsTheInstructionAndLocalResponseInOneConversation() {
    InMemoryConversations repository = new InMemoryConversations();
    ResourceId projectId = ResourceId.newId();
    Conversation conversation = new Conversation(
        ResourceId.newId(), projectId, Conversation.RecipientType.PM,
        ResourceId.newId(), List.of());
    repository.save(conversation);
    ConversationService service = new ConversationService(
        repository, new AgentLoop(prompt -> "respuesta local: " + prompt,
                                  (id, status, related) -> {
                                  }));

    ConversationService.Exchange exchange = service.instructAndRespond(
        conversation.id(), "Preparar el plan", null, null, null);

    assertThat(exchange.instruction().origin()).isEqualTo(Instruction.Origin.USER);
    assertThat(exchange.response().origin())
        .isEqualTo(Instruction.Origin.PROJECT_MANAGER);
    assertThat(exchange.response().content()).isEqualTo(
        "respuesta local: Preparar el plan");
    assertThat(exchange.conversation().instructions()).containsExactly(
        exchange.instruction(), exchange.response());
  }

  private static final class InMemoryConversations
      implements ConversationRepository {
    private final List<Conversation> conversations = new ArrayList<>();

    @Override
    public void save(Conversation conversation) {
      conversations.add(conversation);
    }

    @Override
    public void append(Instruction instruction) {
      Conversation current = findById(instruction.conversationId()).orElseThrow();
      conversations.remove(current);
      conversations.add(current.append(instruction));
    }

    @Override
    public Optional<Conversation> findById(ResourceId id) {
      return conversations.stream()
          .filter(conversation -> conversation.id().equals(id))
          .findFirst();
    }

    @Override
    public List<Conversation> findByProjectId(ResourceId projectId) {
      return conversations.stream()
          .filter(conversation -> conversation.projectId().equals(projectId))
          .toList();
    }
  }
}
