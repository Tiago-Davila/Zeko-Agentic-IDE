package com.zeko.memorysearch.api;

import com.zeko.memorysearch.application.ContextIndex;
import java.util.List;

public final class MemoryDtos {
  private MemoryDtos() {}
  public record SearchResponse(List<Result> results) {}
  public record Result(String sourceId, String level, String excerpt) {
    static Result from(ContextIndex.Result result) {
      return new Result(result.sourceId().asString(), result.level(), result.excerpt());
    }
  }
}
