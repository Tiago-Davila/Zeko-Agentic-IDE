package com.zeko.memorysearch.api;

import com.zeko.memorysearch.application.MemorySearchService;
import com.zeko.memorysearch.application.MemorySourceService;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}")
public class MemoryController {
  private final MemorySearchService search;
  private final MemorySourceService sources;

  public MemoryController(MemorySearchService search,
                          MemorySourceService sources) {
    this.search = search;
    this.sources = sources;
  }

  @GetMapping("/memory/search")
  public MemoryDtos.SearchResponse search(@PathVariable String projectId,
                                          @RequestParam(required = false) String conversationId,
                                          @RequestParam(required = false) String ownerId,
                                          @RequestParam String query) {
    ResourceId id = ResourceId.parse(projectId);
    var results = conversationId != null
        ? search.search(id, ResourceId.parse(conversationId), query)
        : search.search(id, ResourceId.parse(ownerId == null ? projectId : ownerId), query,
                        true);
    return new MemoryDtos.SearchResponse(
        results.stream().map(MemoryDtos.Result::from).toList());
  }

  @PostMapping("/memory-sources")
  public ResponseEntity<MemoryDtos.SourceResponse> register(
      @PathVariable String projectId, @RequestBody MemoryDtos.SourceInput input) {
    if (input == null) {
      throw com.zeko.sharedkernel.domain.DomainError.validation(
          "La fuente de memoria es obligatoria");
    }
    MemoryEntry entry = sources.register(ResourceId.parse(projectId), input.path(),
                                         input.scope(), input.ownerId());
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(MemoryDtos.SourceResponse.from(entry));
  }
}
