package com.zeko.coordination;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zeko.sharedkernel.api.LocalSessionFilter;
import jakarta.servlet.http.Cookie;
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

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ModeSettingsContractTest {

    @TempDir
    static Path localDataDir;

    @Autowired
    private MockMvc mockMvc;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("mode-api.db").toString());
    }

    @Test
    void keepsBothModeRoutesIndependentAndValidatesInstance() throws Exception {
        Cookie session = session();
        String unknown = "00000000-0000-0000-0000-000000000001";
        mockMvc.perform(put("/api/agent-instances/" + unknown + "/permission-mode").cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissionMode\":\"FULL_ACCESS\",\"autoApproveRules\":[]}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/agent-instances/" + unknown + "/autonomy-mode").cookie(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"autonomyMode\":\"AUTONOMOUS\"}"))
                .andExpect(status().isNotFound());
    }

    private Cookie session() throws Exception {
        return mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                        "/api/session/bootstrap"))
                .andReturn().getResponse().getCookie(LocalSessionFilter.COOKIE_NAME);
    }
}
