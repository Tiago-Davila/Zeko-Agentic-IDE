package com.zeko.agentdesign;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zeko.sharedkernel.api.LocalSessionFilter;
import jakarta.servlet.http.Cookie;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AgentApiContractTest {
    @TempDir static Path localDataDir;
    @Autowired private MockMvc mockMvc;
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("agent-api.db").toString());
    }
    @Test void rejectsAnUnknownProjectWithoutCreatingAnAgent() throws Exception {
        mockMvc.perform(post("/api/projects/00000000-0000-0000-0000-000000000001/agent-templates")
                        .cookie(session()).contentType("application/json")
                        .content("{\"name\":\"Planner\",\"configuration\":{}}"))
                .andExpect(status().isNotFound());
    }
    @Test void rejectsUnknownInstances() throws Exception {
        mockMvc.perform(get("/api/agent-instances/00000000-0000-0000-0000-000000000001").cookie(session()))
                .andExpect(status().isNotFound());
    }
    private Cookie session() throws Exception {
        return mockMvc.perform(post("/api/session/bootstrap"))
                .andReturn().getResponse().getCookie(LocalSessionFilter.COOKIE_NAME);
    }
}
