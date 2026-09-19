package com.zeko.sharedkernel;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.zeko.sharedkernel.application.ClockPort;
import com.zeko.sharedkernel.application.LocalSessionPort;
import com.zeko.sharedkernel.api.LocalSessionFilter;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.infrastructure.LocalSessionStore;
import jakarta.servlet.http.Cookie;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class LocalSessionContractTest {

    @TempDir
    static Path localDataDir;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private Environment environment;

    @DynamicPropertySource
    static void localDatabase(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("zeko.db").toString());
    }

    @Test
    void elBootstrapEmiteCookieEfimeraYNoDevuelveElToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/session/bootstrap"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.loopbackOnly").value(true))
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andExpect(cookie().exists(LocalSessionFilter.COOKIE_NAME))
                .andExpect(cookie().httpOnly(LocalSessionFilter.COOKIE_NAME, true))
                .andExpect(cookie().secure(LocalSessionFilter.COOKIE_NAME, false))
                .andExpect(cookie().path(LocalSessionFilter.COOKIE_NAME, "/api"))
                .andExpect(cookie().maxAge(LocalSessionFilter.COOKIE_NAME, 1_800))
                .andReturn();

        String token = result.getResponse().getCookie(LocalSessionFilter.COOKIE_NAME).getValue();
        String body = result.getResponse().getContentAsString();

        Assertions.assertThat(token).isNotBlank();
        Assertions.assertThat(body).doesNotContain(token);
        Assertions.assertThat(body).doesNotContain("token");
        Assertions.assertThat(result.getResponse().getHeader("Set-Cookie")).contains("SameSite=Strict");
    }

    @Test
    void laConsultaDeSesionExigeUnaSesionValida() throws Exception {
        mockMvc.perform(get("/api/session"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthorized"))
                .andExpect(jsonPath("$.correlationId").isNotEmpty());
    }

    @Test
    void laConsultaDeSesionRespondeConLaSesionVigente() throws Exception {
        Cookie session = bootstrapCookie();

        mockMvc.perform(get("/api/session").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loopbackOnly").value(true))
                .andExpect(jsonPath("$.expiresAt").isNotEmpty());
    }

    @Test
    void unaCookieDesconocidaNoAutoriza() throws Exception {
        mockMvc.perform(get("/api/session").cookie(new Cookie(LocalSessionFilter.COOKIE_NAME, "token-inventado")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthorized"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://malicioso.example", "https://127.0.0.1.evil.com", "http://192.168.1.10:5173"})
    void rechazaOrigenNoAutorizadoInclusoConSesionValida(String origin) throws Exception {
        Cookie session = bootstrapCookie();

        mockMvc.perform(get("/api/session").cookie(session).header("Origin", origin))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "null",
        " ",
        "file://localhost",
        "ftp://localhost",
        "http://intruso@localhost:5173",
        "http://localhost:5173/ruta",
        "http://localhost:70000"
    })
    void rechazaOrigenOpacoOMalformado(String origin) throws Exception {
        mockMvc.perform(post("/api/session/bootstrap").header("Origin", origin))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://[::1]:8080"
    })
    void aceptaOrigenLocalDelMismoHost(String origin) throws Exception {
        Cookie session = bootstrapCookie();

        mockMvc.perform(get("/api/session").cookie(session).header("Origin", origin))
                .andExpect(status().isOk());
    }

    @Test
    void rechazaHostNoAutorizado() throws Exception {
        Cookie session = bootstrapCookie();

        mockMvc.perform(get("/api/session").cookie(session).header("Host", "zeko.example.com"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @ParameterizedTest
    @ValueSource(strings = {" ", "localhost:abc", "localhost:70000", "[::1", "[::1]extra", "127.0.0.1.evil"})
    void rechazaHostLocalMalformado(String host) throws Exception {
        mockMvc.perform(post("/api/session/bootstrap").header("Host", host))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"localhost", "localhost:8080", "127.0.0.1:8080", "[::1]:8080"})
    void aceptaHostLocalValido(String host) throws Exception {
        mockMvc.perform(post("/api/session/bootstrap").header("Host", host))
                .andExpect(status().isCreated());
    }

    @Test
    void rechazaClienteQueNoEsDeLoopback() throws Exception {
        mockMvc.perform(post("/api/session/bootstrap").with(request -> {
                    request.setRemoteAddr("203.0.113.7");
                    return request;
                }))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @Test
    void elBootstrapNoExigeSesionPreviaPeroSiLoopback() throws Exception {
        mockMvc.perform(post("/api/session/bootstrap")).andExpect(status().isCreated());
    }

    @Test
    void elServidorSeConfiguraSoloEnLoopback() {
        Assertions.assertThat(environment.getProperty("server.address")).isEqualTo("127.0.0.1");
        Assertions.assertThat(environment.getProperty("server.forward-headers-strategy")).isEqualTo("none");
    }

    @Test
    void unaMutacionSinSesionSeRechazaAntesDeResolverLaRuta() throws Exception {
        mockMvc.perform(post("/api/projects"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthorized"));
    }

    @Test
    void unaMutacionConSesionValidaSuperaElBoundaryDeSesion() throws Exception {
        mockMvc.perform(post("/api/projects").cookie(bootstrapCookie()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation"));
    }

    @Test
    void laSesionExpiraYDejaDeAutorizar() {
        Instant start = Instant.parse("2026-09-13T00:00:00Z");
        MutableClock clock = new MutableClock(start);
        LocalSessionStore store = new LocalSessionStore(clock, Duration.ofMinutes(30));

        LocalSessionPort.IssuedSession issued = store.issue();
        Assertions.assertThat(store.validate(issued.token())).isPresent();

        clock.set(start.plus(Duration.ofMinutes(29)));
        Assertions.assertThat(store.validate(issued.token())).isPresent();

        clock.set(start.plus(Duration.ofMinutes(30)));
        Assertions.assertThat(store.validate(issued.token())).isEmpty();
        Assertions.assertThat(store.activeCount()).isZero();
    }

    @Test
    void elStoreNoExponeElTokenEnSuRepresentacion() {
        LocalSessionStore store = new LocalSessionStore(ClockPort.fixed(Instant.EPOCH), Duration.ofMinutes(5));
        LocalSessionPort.IssuedSession issued = store.issue();

        Assertions.assertThat(issued.toString()).doesNotContain(issued.token());
        Assertions.assertThat(store.toString()).doesNotContain(issued.token());
    }

    @Test
    void cadaBootstrapEmiteUnTokenDistinto() {
        LocalSessionStore store = new LocalSessionStore(ClockPort.fixed(Instant.EPOCH), Duration.ofMinutes(5));

        Assertions.assertThat(store.issue().token()).isNotEqualTo(store.issue().token());
        Assertions.assertThat(store.activeCount()).isEqualTo(2);
    }

    @Test
    void laConfiguracionExigeUnaDuracionEfimeraPositiva() {
        Assertions.assertThatThrownBy(() -> new LocalSessionStore.SessionProperties(null))
                .isInstanceOf(DomainError.class);
        Assertions.assertThatThrownBy(() -> new LocalSessionStore.SessionProperties(Duration.ZERO))
                .isInstanceOf(DomainError.class);
        Assertions.assertThatThrownBy(() -> new LocalSessionStore.SessionProperties(Duration.ofSeconds(-1)))
                .isInstanceOf(DomainError.class);
        Assertions.assertThat(new LocalSessionStore.SessionProperties(Duration.ofMinutes(30)).ttl())
                .isEqualTo(Duration.ofMinutes(30));
    }

    @Test
    void unaCookieDeTamanoArbitrarioSeRechazaSinProcesarlaComoToken() {
        LocalSessionStore store = new LocalSessionStore(ClockPort.fixed(Instant.EPOCH), Duration.ofMinutes(5));

        Assertions.assertThat(store.validate("x".repeat(10_000))).isEmpty();
        Assertions.assertThat(store.validate("!" + "x".repeat(42))).isEmpty();
    }

    @Test
    void invalidarUnaSesionLaDejaDeAutorizar() {
        LocalSessionStore store = new LocalSessionStore(ClockPort.fixed(Instant.EPOCH), Duration.ofMinutes(5));
        LocalSessionPort.IssuedSession issued = store.issue();

        store.invalidate(issued.token());

        Assertions.assertThat(store.validate(issued.token())).isEmpty();
        Assertions.assertThat(store.validate(null)).isEmpty();
        Assertions.assertThat(store.validate("  ")).isEmpty();
    }

    private Cookie bootstrapCookie() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/session/bootstrap"))
                .andExpect(status().isCreated())
                .andReturn();

        return Optional.ofNullable(result.getResponse().getCookie(LocalSessionFilter.COOKIE_NAME))
                .orElseThrow(() -> new IllegalStateException("El bootstrap no emitio cookie local"));
    }

    private static final class MutableClock implements ClockPort {

        private volatile Instant current;

        private MutableClock(Instant current) {
            this.current = current;
        }

        private void set(Instant value) {
            this.current = value;
        }

        @Override
        public Instant now() {
            return current;
        }
    }
}
