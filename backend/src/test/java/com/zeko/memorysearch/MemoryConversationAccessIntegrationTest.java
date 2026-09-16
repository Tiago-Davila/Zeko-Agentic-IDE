package com.zeko.memorysearch;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.coordination.application.ConversationContextProvider;
import com.zeko.coordination.domain.Conversation;
import com.zeko.memorysearch.application.ContextIndex;
import com.zeko.memorysearch.application.MemoryRepository;
import com.zeko.memorysearch.application.MemorySearchService;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.memorysearch.domain.MemoryScope;
import com.zeko.memorysearch.infrastructure.LuceneContextIndex;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class MemoryConversationAccessIntegrationTest {
  @Test
  void returnsOnlyMetadataAndContentAllowedForTheActiveConversation() {
    ResourceId project = ResourceId.newId();
    ResourceId otherProject = ResourceId.newId();
    ResourceId conversation = ResourceId.newId();
    ResourceId agent = ResourceId.newId();
    InMemoryRepository entries = new InMemoryRepository();
    LuceneContextIndex index = new LuceneContextIndex();
    MemorySearchService service = new MemorySearchService(entries, index,
        context(project, conversation, agent));

    MemoryEntry global = entry(MemoryScope.GLOBAL, null, ResourceId.newId(),
        "global.md", MemoryEntry.IndexState.CURRENT, false);
    MemoryEntry projectEntry = entry(MemoryScope.PROJECT, project, project,
        "project.md", MemoryEntry.IndexState.CURRENT, false);
    MemoryEntry agentEntry = entry(MemoryScope.AGENT, project, agent,
        "agent.md", MemoryEntry.IndexState.CURRENT, false);
    MemoryEntry conversationEntry = entry(MemoryScope.CONVERSATION, project, conversation,
        "conversation.md", MemoryEntry.IndexState.CURRENT, false);
    MemoryEntry staleEntry = entry(MemoryScope.PROJECT, project, project,
        "stale.md", MemoryEntry.IndexState.STALE, false);
    MemoryEntry foreignEntry = entry(MemoryScope.PROJECT, otherProject, otherProject,
        "foreign.md", MemoryEntry.IndexState.CURRENT, false);
    MemoryEntry secretEntry = entry(MemoryScope.CONVERSATION, project, conversation,
        "secret.md", MemoryEntry.IndexState.EXCLUDED, true);

    index(entries, index, global, "global context");
    index(entries, index, projectEntry, "project context");
    index(entries, index, agentEntry, "agent context");
    index(entries, index, conversationEntry, "conversation context");
    index(entries, index, staleEntry, "stale context");
    index(entries, index, foreignEntry, "foreign context");
    index(entries, index, secretEntry, "synthetic-secret");

    List<ContextIndex.Result> results = service.search(project, conversation, "context");

    assertThat(results).extracting(ContextIndex.Result::source)
        .containsExactlyInAnyOrder("global.md", "project.md", "agent.md",
            "conversation.md")
        .doesNotContain("foreign.md", "secret.md", "stale.md");
    assertThat(results).extracting(ContextIndex.Result::excerpt)
        .doesNotContain("synthetic-secret");
  }

  private static ConversationContextProvider context(ResourceId project,
                                                       ResourceId conversation,
                                                       ResourceId agent) {
    return (requestedProject, requestedConversation) -> {
      assertThat(requestedProject).isEqualTo(project);
      assertThat(requestedConversation).isEqualTo(conversation);
      return new ConversationContextProvider.Context(project, conversation,
          Conversation.RecipientType.AGENT, agent);
    };
  }

  private static MemoryEntry entry(MemoryScope scope, ResourceId project,
                                   ResourceId owner, String source,
                                   MemoryEntry.IndexState state, boolean sensitive) {
    return new MemoryEntry(ResourceId.newId(), scope, project, owner, source,
        "fingerprint", state, sensitive);
  }

  private static void index(InMemoryRepository entries, LuceneContextIndex index,
                            MemoryEntry entry, String content) {
    entries.save(entry);
    index.index(entry, content);
  }

  private static final class InMemoryRepository implements MemoryRepository {
    private final Map<ResourceId, MemoryEntry> values = new LinkedHashMap<>();

    @Override
    public void save(MemoryEntry entry) {
      values.put(entry.id(), entry);
    }

    @Override
    public Optional<MemoryEntry> find(ResourceId id) {
      return Optional.ofNullable(values.get(id));
    }

    @Override
    public List<MemoryEntry> findForProject(ResourceId projectId) {
      return values.values().stream()
          .filter(entry -> entry.projectId() == null || entry.projectId().equals(projectId))
          .toList();
    }
  }
}
