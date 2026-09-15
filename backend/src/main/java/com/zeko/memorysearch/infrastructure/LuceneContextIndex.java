package com.zeko.memorysearch.infrastructure;

import com.zeko.memorysearch.application.ContextIndex;
import com.zeko.memorysearch.application.MemoryAccessContext;
import com.zeko.memorysearch.domain.MemoryAccessPolicy;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class LuceneContextIndex implements ContextIndex {
  private final Map<ResourceId, Document> documents = new ConcurrentHashMap<>();
  private final MemoryAccessPolicy access = new MemoryAccessPolicy();

  @Override
  public void index(MemoryEntry entry, String content) {
    documents.put(entry.id(), new Document(entry, content));
  }

  @Override
  public List<Result> search(MemoryAccessContext context, String query) {
    String needle =
        query == null ? "" : query.toLowerCase(java.util.Locale.ROOT);
    return documents.values()
        .stream()
        .filter(document -> access.permitsMetadata(document.entry, context.projectId(),
            context.conversationId(), context.agentInstanceId()))
        .filter(document -> document.entry.indexState() != MemoryEntry.IndexState.CURRENT
            || document.content.toLowerCase(java.util.Locale.ROOT).contains(needle))
        .map(document
             -> new Result(document.entry.id(), document.entry.scope().name(),
                           document.entry.ownerId(), source(document.entry),
                           document.entry.indexState(),
                           access.permitsContent(document.entry, context.projectId(),
                               context.conversationId(), context.agentInstanceId())
                               ? document.content.substring(
                                   0, Math.min(240, document.content.length()))
                               : ""))
        .toList();
  }

  private static String source(MemoryEntry entry) {
    return java.nio.file.Path.of(entry.sourcePath()).getFileName().toString();
  }

  private record Document(MemoryEntry entry, String content) {}
}
