package com.zeko.memorysearch.api;

import com.zeko.memorysearch.application.MemorySearchService;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}/memory")
public class MemoryController {
  private final MemorySearchService search;
  public MemoryController(MemorySearchService search) {
    this.search = search;
  }
  @GetMapping("/search")
  public MemoryDtos.SearchResponse search(@PathVariable String projectId,
                                          @RequestParam String ownerId,
                                          @RequestParam String query) {
    return new MemoryDtos.SearchResponse(
        search.search(ResourceId.parse(projectId), ResourceId.parse(ownerId), query)
            .stream().map(MemoryDtos.Result::from).toList());
  }
}
