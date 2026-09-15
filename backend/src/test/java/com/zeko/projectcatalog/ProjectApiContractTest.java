package com.zeko.projectcatalog;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zeko.sharedkernel.api.LocalSessionFilter;
import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectApiContractTest {

    @TempDir
    static Path localDataDir;

    @Autowired
    private MockMvc mockMvc;

    @DynamicPropertySource
    static void localDatabase(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("project-api.db").toString());
    }

    @Test
    void createsListsAndReopensAProjectWithItsRepository() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/projects")
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Zeko\",\"rootPath\":\"workspace/zeko\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Zeko"))
                .andReturn();
        String projectId = com.jayway.jsonpath.JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        Path repository = gitRepository();

        mockMvc.perform(post("/api/projects/{projectId}/repositories", projectId)
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"path\":\"" + jsonValue(repository) + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.projectId").value(projectId))
                .andExpect(jsonPath("$.accessState").value("AVAILABLE"));

        mockMvc.perform(get("/api/projects/{projectId}", projectId).cookie(sessionCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repositories").isArray())
                .andExpect(jsonPath("$.repositories.length()").value(1));
        mockMvc.perform(get("/api/projects").cookie(sessionCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + projectId + "')]").isNotEmpty());
    }

    @Test
    void reportsInvalidAndDuplicateRepositoryPathsWithoutRemovingTheProject() throws Exception {
        String projectId = createProject();
        Path nonGit = Files.createDirectory(localDataDir.resolve("not-git"));

        mockMvc.perform(post("/api/projects/{projectId}/repositories", projectId)
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"path\":\"" + jsonValue(nonGit) + "\"}"))
                .andExpect(status().isUnprocessableEntity());

        Path repository = gitRepository();
        String request = "{\"path\":\"" + jsonValue(repository) + "\"}";
        mockMvc.perform(post("/api/projects/{projectId}/repositories", projectId)
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/projects/{projectId}/repositories", projectId)
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isConflict());
        mockMvc.perform(get("/api/projects/{projectId}", projectId).cookie(sessionCookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repositories.length()").value(1));
    }

    private String createProject() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/projects")
                        .cookie(sessionCookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Zeko\",\"rootPath\":\"workspace/zeko\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }

    private Cookie sessionCookie() throws Exception {
        MvcResult bootstrap = mockMvc.perform(post("/api/session/bootstrap"))
                .andExpect(status().isCreated())
                .andReturn();
        return bootstrap.getResponse().getCookie(LocalSessionFilter.COOKIE_NAME);
    }

    private Path gitRepository() throws IOException, InterruptedException {
        Path repository = Files.createTempDirectory(localDataDir, "repo-");
        Process process = new ProcessBuilder("git", "init", "--quiet")
                .directory(repository.toFile())
                .redirectErrorStream(true)
                .start();
        if (process.waitFor() != 0) {
            throw new IllegalStateException("No se pudo inicializar el repositorio temporal");
        }
        return repository;
    }

    private static String jsonValue(Path value) {
        return value.toString().replace("\\", "\\\\");
    }
}
