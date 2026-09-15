package com.zeko.memorysearch;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zeko.memorysearch.api.MemoryController;
import com.zeko.memorysearch.application.ContextIndex;
import com.zeko.memorysearch.application.MemorySearchService;
import com.zeko.memorysearch.application.MemorySourceService;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.memorysearch.domain.MemoryScope;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class MemoryContractTest {

  @Test
  void exposesScopedSearchResultsThroughTheLocalApi() throws Exception {
    ResourceId projectId = ResourceId.newId();
    ResourceId sourceId = ResourceId.newId();
    MemorySearchService search = mock(MemorySearchService.class);
    MemorySourceService sources = mock(MemorySourceService.class);
    when(search.search(projectId, projectId, "documentacion"))
        .thenReturn(List.of(new ContextIndex.Result(sourceId, "PROJECT",
                                                    "documentacion local")));
    MockMvc mvc = mvc(search, sources);

    mvc.perform(get("/api/projects/{projectId}/memory/search", projectId)
            .param("query", "documentacion"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.results[0].sourceId").value(sourceId.asString()))
        .andExpect(jsonPath("$.results[0].level").value("PROJECT"))
        .andExpect(jsonPath("$.results[0].excerpt").value("documentacion local"));
  }

  @Test
  void returnsThePersistedSourceStateAfterRegistration() throws Exception {
    ResourceId projectId = ResourceId.newId();
    MemoryEntry entry = new MemoryEntry(
        ResourceId.newId(), MemoryScope.PROJECT, projectId, projectId,
        "/tmp/notes.md", "fingerprint", MemoryEntry.IndexState.CURRENT, false);
    MemorySearchService search = mock(MemorySearchService.class);
    MemorySourceService sources = mock(MemorySourceService.class);
    when(sources.register(projectId, "notes.md", "PROJECT", null))
        .thenReturn(entry);
    MockMvc mvc = mvc(search, sources);

    mvc.perform(post("/api/projects/{projectId}/memory-sources", projectId)
            .contentType("application/json")
            .content("{\"path\":\"notes.md\",\"scope\":\"PROJECT\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(entry.id().asString()))
        .andExpect(jsonPath("$.scope").value("PROJECT"))
        .andExpect(jsonPath("$.indexState").value("CURRENT"));

    verify(sources).register(projectId, "notes.md", "PROJECT", null);
  }

  private static MockMvc mvc(MemorySearchService search,
                             MemorySourceService sources) {
    return MockMvcBuilders.standaloneSetup(new MemoryController(search, sources))
        .build();
  }
}
