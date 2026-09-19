package com.zeko.memorysearch;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.memorysearch.domain.MemoryAccessPolicy;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.memorysearch.domain.MemoryScope;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.junit.jupiter.api.Test;

class MemoryAccessPolicyTest {

  private final MemoryAccessPolicy access = new MemoryAccessPolicy();

  @Test
  void keepsProjectAgentAndConversationEntriesWithinTheirOwners() {
    ResourceId projectId = ResourceId.newId();
    ResourceId otherProjectId = ResourceId.newId();
    ResourceId agentId = ResourceId.newId();
    ResourceId conversationId = ResourceId.newId();
    MemoryEntry project = entry(MemoryScope.PROJECT, projectId, projectId);
    MemoryEntry agent = entry(MemoryScope.AGENT, projectId, agentId);
    MemoryEntry conversation = entry(MemoryScope.CONVERSATION, projectId, conversationId);
    MemoryEntry otherProject = entry(MemoryScope.PROJECT, otherProjectId, otherProjectId);

    assertThat(access.permits(project, projectId, List.of(ResourceId.newId()))).isTrue();
    assertThat(access.permits(otherProject, projectId, List.of(projectId))).isFalse();
    assertThat(access.permits(agent, projectId, List.of(agentId))).isTrue();
    assertThat(access.permits(agent, projectId, List.of(ResourceId.newId()))).isFalse();
    assertThat(access.permits(conversation, projectId, List.of(conversationId))).isTrue();
    assertThat(access.permits(conversation, projectId, List.of(ResourceId.newId()))).isFalse();
  }

  @Test
  void exposesGlobalContextWithoutPromotingProjectContextAndRejectsUnsafeEntries() {
    ResourceId projectId = ResourceId.newId();
    MemoryEntry global = entry(MemoryScope.GLOBAL, null, ResourceId.newId());
    MemoryEntry stale = entry(MemoryScope.PROJECT, projectId, projectId,
                              MemoryEntry.IndexState.STALE, false);
    MemoryEntry sensitive = entry(MemoryScope.PROJECT, projectId, projectId,
                                  MemoryEntry.IndexState.CURRENT, true);

    assertThat(access.permits(global, projectId, List.of(ResourceId.newId()))).isTrue();
    assertThat(access.permits(stale, projectId, List.of(projectId))).isFalse();
    assertThat(access.permits(sensitive, projectId, List.of(projectId))).isFalse();
  }

  private static MemoryEntry entry(MemoryScope scope, ResourceId projectId,
                                   ResourceId ownerId) {
    return entry(scope, projectId, ownerId, MemoryEntry.IndexState.CURRENT, false);
  }

  private static MemoryEntry entry(MemoryScope scope, ResourceId projectId,
                                   ResourceId ownerId, MemoryEntry.IndexState state,
                                   boolean sensitive) {
    return new MemoryEntry(ResourceId.newId(), scope, projectId, ownerId,
                           "notes.txt", "fingerprint", state, sensitive);
  }
}
