package com.zeko.coordination;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.coordination.application.ConversationRepository;
import com.zeko.coordination.domain.Conversation;
import com.zeko.coordination.domain.Instruction;
import com.zeko.coordination.domain.InstructionPrecedence;
import com.zeko.projectcatalog.application.ProjectRepository;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class ConversationStoreIntegrationTest {
  @TempDir static Path localDataDir;
  @Autowired private ConversationRepository conversations;
  @Autowired private ProjectRepository projects;

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry registry) {
    registry.add("zeko.datasource.path",
                 () -> localDataDir.resolve("conversations.db").toString());
  }

  @Test
  void preservesTheCompleteInstructionHistory() {
    ResourceId projectId = ResourceId.newId();
    projects.save(
        Project.create(projectId, "Zeko", localDataDir.resolve("project")));
    Conversation conversation = new Conversation(ResourceId.newId(), projectId,
                                                 Conversation.RecipientType.PM,
                                                 ResourceId.newId(), List.of());
    conversations.save(conversation);
    Instruction first = instruction(conversation.id(),
                                    Instruction.Origin.PROJECT_MANAGER, null);
    Instruction override =
        instruction(conversation.id(), Instruction.Origin.USER, first.id());
    conversations.append(first);
    conversations.append(override);
    assertThat(
        conversations.findById(conversation.id()).orElseThrow().instructions())
        .containsExactlyInAnyOrder(first, override);
  }

  private static Instruction instruction(ResourceId conversationId,
                                         Instruction.Origin origin,
                                         ResourceId overrideOf) {
    return new Instruction(ResourceId.newId(), conversationId, origin,
                           "Continuar",
                           InstructionPrecedence.valueOf(origin.name()),
                           overrideOf, overrideOf == null ? null : "project",
                           overrideOf == null ? null : ResourceId.newId(),
                           Instant.parse("2026-09-14T18:00:00Z"));
  }
}
