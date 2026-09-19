package com.zeko.sharedkernel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
class LocalSpaIntegrationTest {

    private static final Pattern SCRIPT_ASSET = Pattern.compile("src=\\\"(/assets/[^\\\"]+\\.js)\\\"");

    @TempDir
    static Path localDataDir;

    @Autowired
    private MockMvc mockMvc;

    @DynamicPropertySource
    static void localDatabase(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("zeko.db").toString());
    }

    @Test
    void sirveLaSpaYLosAssetsCompiladosDesdeElMismoOrigen() throws Exception {
        MvcResult index = mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andReturn();

        String body = index.getResponse().getContentAsString();
        Matcher asset = SCRIPT_ASSET.matcher(body);
        assertThat(asset.find()).isTrue();

        mockMvc.perform(get(asset.group(1)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/javascript"));
    }

    @Test
    void lasRutasDesconocidasMantienenElContratoDeError() throws Exception {
        mockMvc.perform(get("/ruta-inexistente"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/no-existe"))
                .andExpect(status().isUnauthorized());
    }
}
