package com.zeko.memorysearch.infrastructure;

import com.zeko.memorysearch.application.ContextIndex;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class LuceneContextIndex implements ContextIndex {
  private final Map<ResourceId, Document> documents = new ConcurrentHashMap<>();

  @Override
  public void index(MemoryEntry entry, String content) {
    documents.put(entry.id(), new Document(entry, content));
  }

  @Override
  public List<Result> search(ResourceId projectId, ResourceId ownerId,
                             String query) {
    String needle =
        query == null ? "" : query.toLowerCase(java.util.Locale.ROOT);
    return documents.values()
        .stream()
        .filter(document
                -> document.entry.projectId() == null ||
                       document.entry.projectId().equals(projectId))
        .filter(document
                -> document.entry.ownerId().equals(ownerId) ||
                       document.entry.scope().name().equals("GLOBAL"))
        .filter(document
                -> document.content.toLowerCase(java.util.Locale.ROOT)
                       .contains(needle))
        .map(document
             -> new Result(document.entry.id(), document.entry.scope().name(),
                           document.content.substring(
                               0, Math.min(240, document.content.length()))))
        .toList();
  }

  private record Document(MemoryEntry entry, String content) {}
}
