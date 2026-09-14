package com.zeko.sharedkernel;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zeko.sharedkernel.api.CorrelationFilter;
import com.zeko.sharedkernel.api.LocalSessionFilter;
import com.zeko.sharedkernel.domain.DomainError;
import jakarta.servlet.http.Cookie;
import java.nio.file.Path;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest
@AutoConfigureMockMvc
class HttpErrorsContractTest {

    private static final String UUID_PATTERN =
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

    private static final String SECRETO = "ghp_tokenLocalQueNoDebeViajar";

    @TempDir
    static Path localDataDir;

    @Autowired
    private MockMvc mockMvc;

    @DynamicPropertySource
    static void localDatabase(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("zeko.db").toString());
    }

    @TestConfiguration
    static class FailingEndpoints {

        @Bean
        FailingController failingController() {
            return new FailingController();
        }
    }

    @RestController
    @RequestMapping("/test-errors")
    static class FailingController {

        @PostMapping("/domain")
        String domain(@RequestParam String kind) {
            throw switch (kind) {
                case "validation" -> DomainError.validation("campo requerido");
                case "unauthorized" -> DomainError.unauthorized("sesion local ausente");
                case "forbidden" -> DomainError.forbidden("origen no autorizado");
                case "not-found" -> DomainError.notFound("Project", com.zeko.sharedkernel.domain.ResourceId.newId());
                case "conflict" -> DomainError.conflict("estado en conflicto");
                case "approval-stale" -> DomainError.approvalStale("la revision cambio");
                case "path-invalid" -> DomainError.pathInvalid("ruta local invalida");
                case "blocked" -> DomainError.blocked("task bloqueada por conflicto manual");
                default -> DomainError.providerUnavailable("proveedor local no disponible");
            };
        }

        @PostMapping("/unexpected")
        String unexpected() {
            throw new IllegalStateException("detalle interno con " + SECRETO);
        }

        @PostMapping("/body")
        String body(@RequestBody Payload payload) {
            return payload.name();
        }

        record Payload(String name) { }
    }

    @ParameterizedTest
    @CsvSource({
        "validation,      400, validation",
        "unauthorized,    401, unauthorized",
        "forbidden,       403, forbidden",
        "not-found,       404, not-found",
        "conflict,        409, conflict",
        "approval-stale,  409, approval-stale",
        "path-invalid,    422, path-invalid",
        "blocked,         423, blocked",
        "provider,        503, provider-unavailable"
    })
    void traduceCadaErrorDeDominioAlContrato(String kind, int expectedStatus, String expectedCode) throws Exception {
        mockMvc.perform(post("/test-errors/domain").param("kind", kind))
                .andExpect(status().is(expectedStatus))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(expectedCode))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.correlationId", matchesPattern(UUID_PATTERN)));
    }

    @Test
    void elCuerpoDeErrorSoloTraeLosCamposDelContrato() throws Exception {
        mockMvc.perform(post("/test-errors/domain").param("kind", "conflict"))
                .andExpect(jsonPath("$.provider").doesNotExist())
                .andExpect(jsonPath("$.knownState").doesNotExist())
                .andExpect(jsonPath("$.retryAllowed").doesNotExist())
                .andExpect(jsonPath("$.stackTrace").doesNotExist())
                .andExpect(jsonPath("$.trace").doesNotExist())
                .andExpect(jsonPath("$.exception").doesNotExist())
                .andExpect(jsonPath("$.path").doesNotExist());
    }

    @Test
    void unFalloInesperadoNoFiltraDetalleInternoNiSecretos() throws Exception {
        MvcResult result = mockMvc.perform(post("/test-errors/unexpected"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("internal"))
                .andExpect(jsonPath("$.correlationId", matchesPattern(UUID_PATTERN)))
                .andReturn();

        String body = result.getResponse().getContentAsString();
        Assertions.assertThat(body)
                .doesNotContain(SECRETO)
                .doesNotContain("IllegalStateException")
                .doesNotContain("java.lang")
                .doesNotContain("com.zeko.sharedkernel.HttpErrorsContractTest")
                .doesNotContain("at ");
    }

    @Test
    void unCuerpoIlegibleSeReportaComoValidacion() throws Exception {
        mockMvc.perform(post("/test-errors/body")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ esto no es json }"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation"))
                .andExpect(jsonPath("$.message").value("El cuerpo de la solicitud no es valido"));
    }

    // Fuera de /api, donde la sesion local no se exige antes de resolver la ruta.
    @Test
    void unaRutaDesconocidaDevuelveElContratoDeError() throws Exception {
        mockMvc.perform(get("/ruta-inexistente"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not-found"));
    }

    @Test
    void unaRutaApiDesconocidaExigeSesionAntesDeRevelarSuExistencia() throws Exception {
        mockMvc.perform(get("/api/ruta-inexistente"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthorized"));
    }

    @Test
    void unaRutaApiDesconocidaConSesionDevuelveNotFound() throws Exception {
        mockMvc.perform(get("/api/ruta-inexistente").cookie(bootstrapCookie()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not-found"));
    }

    @Test
    void generaCorrelacionCuandoElClienteNoLaEnvia() throws Exception {
        mockMvc.perform(post("/test-errors/domain").param("kind", "conflict"))
                .andExpect(header().string(CorrelationFilter.HEADER, matchesPattern(UUID_PATTERN)))
                .andExpect(jsonPath("$.correlationId", matchesPattern(UUID_PATTERN)));
    }

    @Test
    void conservaLaCorrelacionValidaQueEnviaElCliente() throws Exception {
        String correlationId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

        mockMvc.perform(post("/test-errors/domain")
                        .param("kind", "conflict")
                        .header(CorrelationFilter.HEADER, correlationId))
                .andExpect(header().string(CorrelationFilter.HEADER, correlationId))
                .andExpect(jsonPath("$.correlationId").value(correlationId));
    }

    @Test
    void reemplazaUnaCorrelacionQueNoEsIdentificador() throws Exception {
        mockMvc.perform(post("/test-errors/domain")
                        .param("kind", "conflict")
                        .header(CorrelationFilter.HEADER, "<script>alert(1)</script>"))
                .andExpect(header().string(CorrelationFilter.HEADER, matchesPattern(UUID_PATTERN)))
                .andExpect(jsonPath("$.correlationId", matchesPattern(UUID_PATTERN)));
    }

    @Test
    void unaRespuestaCorrectaTambienLlevaCorrelacion() throws Exception {
        mockMvc.perform(post("/test-errors/body")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"zeko\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string(CorrelationFilter.HEADER, matchesPattern(UUID_PATTERN)));
    }

    private Cookie bootstrapCookie() throws Exception {
        MvcResult bootstrap = mockMvc.perform(post("/api/session/bootstrap"))
                .andExpect(status().isCreated())
                .andReturn();
        Cookie cookie = bootstrap.getResponse().getCookie(LocalSessionFilter.COOKIE_NAME);
        if (cookie == null) {
            throw new IllegalStateException("El bootstrap no emitio cookie local");
        }
        return cookie;
    }
}
