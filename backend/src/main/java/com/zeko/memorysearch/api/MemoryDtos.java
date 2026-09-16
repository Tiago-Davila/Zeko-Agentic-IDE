package com.zeko.memorysearch.api;

import com.zeko.memorysearch.application.ContextIndex;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;

public final class MemoryDtos {
  private MemoryDtos() {}
  public record SearchResponse(List<Result> results) {}
  public record SourceInput(String path, String scope, String ownerId) {}
  public record SourceResponse(String id, String scope, String indexState) {
    static SourceResponse from(MemoryEntry entry) {
      return new SourceResponse(entry.id().asString(), entry.scope().name(),
                                entry.indexState().name());
    }
  }
  public record Result(String sourceId, String level, String ownerId, String source,
                       String indexState, String excerpt) {
    public Result(String sourceId, String level, String excerpt) {
      this(sourceId, level, null, "", MemoryEntry.IndexState.CURRENT.name(), excerpt);
    }

    static Result from(ContextIndex.Result result) {
      return new Result(result.sourceId().asString(), result.level(),
          id(result.ownerId()), result.source(), result.indexState().name(),
          result.excerpt());
    }
  }

  private static String id(ResourceId value) {
    return value == null ? null : value.asString();
  }
}
