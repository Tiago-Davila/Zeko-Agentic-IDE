package com.zeko.coordination.application;

import com.zeko.agentdesign.application.AgentService;
import com.zeko.coordination.domain.Conversation;
import com.zeko.coordination.domain.FollowUpProposal;
import com.zeko.coordination.domain.Instruction;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.stereotype.Service;

@Service
public class FollowUpService {
  private final FollowUpRepository proposals;
  private final ConversationRepository conversations;
  private final AgentService agents;

  public FollowUpService(FollowUpRepository proposals,
                         ConversationRepository conversations,
                         AgentService agents) {
    this.proposals = proposals;
    this.conversations = conversations;
    this.agents = agents;
  }

  public FollowUpProposal decide(ResourceId proposalId, String decision) {
    FollowUpProposal proposal = proposals.findById(proposalId)
        .orElseThrow(() -> DomainError.notFound("FollowUpProposal", proposalId));
    Instruction instruction = conversations.findInstructionById(
        proposal.instructionId()).orElseThrow(
            () -> DomainError.conflict("La instruccion de follow-up ya no existe"));
    Conversation conversation = conversations.findById(instruction.conversationId())
        .orElseThrow(() -> DomainError.conflict(
            "La conversacion de follow-up ya no existe"));
    if (!agents.instance(proposal.agentInstanceId()).projectId()
        .equals(conversation.projectId())) {
      throw DomainError.conflict("El agente de follow-up no pertenece al proyecto");
    }
    FollowUpProposal updated = proposal.decide(accepts(decision),
                                                isCurrent(instruction, conversation));
    proposals.save(updated);
    return updated;
  }

  private static boolean accepts(String decision) {
    if ("ACCEPT".equals(decision)) {
      return true;
    }
    if ("REJECT".equals(decision)) {
      return false;
    }
    throw DomainError.validation("La decision de follow-up no es valida");
  }

  private static boolean isCurrent(Instruction instruction,
                                   Conversation conversation) {
    return conversation.instructions().stream()
        .noneMatch(candidate -> instruction.id().equals(candidate.overrideOf()));
  }
}
