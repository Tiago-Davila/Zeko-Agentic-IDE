package com.zeko.coordination;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zeko.agentdesign.application.AgentService;
import com.zeko.agentdesign.domain.AgentInstance;
import com.zeko.agentdesign.domain.AgentTemplate;
import com.zeko.coordination.application.ConversationService;
import com.zeko.coordination.application.ConversationRepository;
import com.zeko.coordination.application.FollowUpRepository;
import com.zeko.coordination.domain.Conversation;
import com.zeko.coordination.domain.FollowUpProposal;
import com.zeko.coordination.domain.Instruction;
import com.zeko.coordination.domain.InstructionPrecedence;
import com.zeko.projectcatalog.application.ProjectService;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.sharedkernel.api.LocalSessionFilter;
import com.zeko.sharedkernel.domain.ResourceId;
import jakarta.servlet.http.Cookie;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class FollowUpContractTest {

  @TempDir
  static Path localDataDir;

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ProjectService projects;

  @Autowired
  private AgentService agents;

  @Autowired
  private ConversationService conversations;

  @Autowired
  private ConversationRepository conversationRepository;

  @Autowired
  private FollowUpRepository proposals;

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry registry) {
    registry.add("zeko.datasource.path",
        () -> localDataDir.resolve("follow-up-api.db").toString());
  }

  @Test
  void acceptsOnePendingProposalForItsCurrentInstruction() throws Exception {
    Seed seed = seed();
    FollowUpProposal proposal = seed.proposal();

    mockMvc.perform(post("/api/follow-up-proposals/{proposalId}/decisions", proposal.id())
            .cookie(session()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"decision\":\"ACCEPT\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(proposal.id().asString()))
        .andExpect(jsonPath("$.state").value("ACCEPTED"));
  }

  @Test
  void expiresAProposalWhoseInstructionWasOverridden() throws Exception {
    Seed seed = seed();
    FollowUpProposal proposal = seed.proposal();
    Instruction instruction = conversations.find(seed.conversationId()).instructions().stream()
        .filter(value -> value.id().equals(proposal.instructionId()))
        .findFirst().orElseThrow();
    conversations.instruct(instruction.conversationId(), "cambio de prioridad",
        instruction.id(), "FOLLOW_UP", proposal.id());

    mockMvc.perform(post("/api/follow-up-proposals/{proposalId}/decisions", proposal.id())
            .cookie(session()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"decision\":\"ACCEPT\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.state").value("EXPIRED"));
  }

  private Seed seed() {
    Project project = projects.create("Coordinacion", localDataDir.toString());
    AgentTemplate template = agents.createOrVersion(project.id(), "Agente", Map.of());
    AgentInstance agent = agents.createInstance(project.id(), template.currentVersion().id(),
        "agent", Map.of("role", "test"));
    Conversation conversation = conversations.create(project.id(),
        Conversation.RecipientType.AGENT, agent.id());
    Instruction instruction = new Instruction(ResourceId.newId(), conversation.id(),
        Instruction.Origin.AGENT, "continuar", InstructionPrecedence.AGENT,
        null, null, null, Instant.now());
    conversationRepository.append(instruction);
    FollowUpProposal proposal = new FollowUpProposal(ResourceId.newId(), instruction.id(),
        agent.id(), "siguiente paso", FollowUpProposal.State.PENDING_CONFIRMATION,
        Instant.now());
    proposals.save(proposal);
    return new Seed(proposal, conversation.id());
  }

  private Cookie session() throws Exception {
    return mockMvc.perform(post("/api/session/bootstrap"))
        .andReturn().getResponse().getCookie(LocalSessionFilter.COOKIE_NAME);
  }

  private record Seed(FollowUpProposal proposal, ResourceId conversationId) {}
}
