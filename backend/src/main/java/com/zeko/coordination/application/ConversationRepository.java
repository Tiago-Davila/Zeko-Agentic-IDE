package com.zeko.coordination.application;

import com.zeko.coordination.domain.Conversation;
import com.zeko.coordination.domain.Instruction;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Optional;

public interface ConversationRepository {
  void save(Conversation conversation);
  void append(Instruction instruction);
  Optional<Conversation> findById(ResourceId conversationId);
  Optional<Instruction> findInstructionById(ResourceId instructionId);
  List<Conversation> findByProjectId(ResourceId projectId);
}
