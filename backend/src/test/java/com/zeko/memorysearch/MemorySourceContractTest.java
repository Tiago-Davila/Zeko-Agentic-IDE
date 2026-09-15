package com.zeko.memorysearch;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.zeko.sharedkernel.api.LocalSessionFilter;
import jakarta.servlet.http.Cookie;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class MemorySourceContractTest {

  @TempDir
  static Path localDataDir;

  @TempDir
  static Path projectRoot;

  @Autowired
  private MockMvc mockMvc;

  @DynamicPropertySource
  static void localStorage(DynamicPropertyRegistry registry) {
    registry.add("zeko.datasource.path",
        () -> localDataDir.resolve("memory-source-api.db").toString());
    registry.add("zeko.memory.index-root",
        () -> localDataDir.resolve("lucene").toString());
  }

  @BeforeEach
  void writeAdmittedSource() throws Exception {
    Files.writeString(projectRoot.resolve("notes.txt"), "documentacion local");
  }

  @Test
  void registersAnAdmittedProjectSourceWithExplicitProjectOwnership()
      throws Exception {
    String projectId = createProject();

    mockMvc.perform(post("/api/projects/{projectId}/memory-sources", projectId)
            .cookie(session()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"path\":\"" + json(projectRoot.resolve("notes.txt"))
                + "\",\"scope\":\"PROJECT\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").isNotEmpty())
        .andExpect(jsonPath("$.scope").value("PROJECT"))
        .andExpect(jsonPath("$.indexState").value("CURRENT"));
  }

  @Test
  void rejectsProjectSourcesThatClaimAnotherOwner() throws Exception {
    String projectId = createProject();

    mockMvc.perform(post("/api/projects/{projectId}/memory-sources", projectId)
            .cookie(session()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"path\":\"" + json(projectRoot.resolve("notes.txt"))
                + "\",\"scope\":\"PROJECT\",\"ownerId\":\""
                + UUID.randomUUID() + "\"}"))
        .andExpect(status().isBadRequest());
  }

  private String createProject() throws Exception {
    MvcResult result = mockMvc.perform(post("/api/projects").cookie(session())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Memoria\",\"rootPath\":\""
                + json(projectRoot) + "\"}"))
        .andExpect(status().isCreated())
        .andReturn();
    return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
  }

  private Cookie session() throws Exception {
    return mockMvc.perform(post("/api/session/bootstrap"))
        .andReturn().getResponse().getCookie(LocalSessionFilter.COOKIE_NAME);
  }

  private static String json(Path path) {
    return path.toString().replace("\\", "\\\\");
  }
}
