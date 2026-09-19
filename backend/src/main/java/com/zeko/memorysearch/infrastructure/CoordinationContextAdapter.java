package com.zeko.memorysearch.infrastructure;

import com.zeko.coordination.application.ContextProvider;
import com.zeko.memorysearch.application.MemorySearchService;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CoordinationContextAdapter implements ContextProvider {
  private final MemorySearchService memory;

  public CoordinationContextAdapter(MemorySearchService memory) {
    this.memory = memory;
  }

  @Override
  public List<Context> context(ResourceId projectId, List<ResourceId> ownerIds,
                               String query) {
    return memory.search(projectId, ownerIds, query).stream()
        .map(result -> new Context(result.sourceId().asString(), result.level(),
                                   result.excerpt()))
        .toList();
  }
}
