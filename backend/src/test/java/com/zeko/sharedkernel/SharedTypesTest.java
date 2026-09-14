package com.zeko.sharedkernel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.sharedkernel.application.ClockPort;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class SharedTypesTest {

    @Nested
    class ResourceIdTest {

        @Test
        void conservaElValorYSuRepresentacionTextual() {
            UUID value = UUID.fromString("7f1d4f52-9b4e-4a1f-9a1a-5b4c3d2e1f00");

            ResourceId id = ResourceId.of(value);

            assertThat(id.value()).isEqualTo(value);
            assertThat(id.asString()).isEqualTo("7f1d4f52-9b4e-4a1f-9a1a-5b4c3d2e1f00");
            assertThat(id).hasToString("7f1d4f52-9b4e-4a1f-9a1a-5b4c3d2e1f00");
        }

        @Test
        void comparaPorValorYNoPorIdentidad() {
            String raw = "7f1d4f52-9b4e-4a1f-9a1a-5b4c3d2e1f00";

            assertThat(ResourceId.parse(raw))
                    .isEqualTo(ResourceId.parse(raw))
                    .hasSameHashCodeAs(ResourceId.parse(raw))
                    .isNotSameAs(ResourceId.parse(raw));
        }

        @Test
        void aceptaEspaciosExternosAlParsear() {
            assertThat(ResourceId.parse("  7f1d4f52-9b4e-4a1f-9a1a-5b4c3d2e1f00  ").asString())
                    .isEqualTo("7f1d4f52-9b4e-4a1f-9a1a-5b4c3d2e1f00");
        }

        @ParameterizedTest
        @ValueSource(strings = {"", "   ", "no-es-uuid", "7f1d4f52-9b4e-4a1f-9a1a", "12345"})
        void rechazaValoresQueNoSonIdentificadores(String raw) {
            assertThatThrownBy(() -> ResourceId.parse(raw))
                    .isInstanceOf(DomainError.class)
                    .extracting(error -> ((DomainError) error).code())
                    .isEqualTo(DomainError.Code.VALIDATION);
        }

        @Test
        void rechazaNuloAlParsearYAlConstruir() {
            assertThatThrownBy(() -> ResourceId.parse(null)).isInstanceOf(DomainError.class);
            assertThatThrownBy(() -> new ResourceId(null)).isInstanceOf(DomainError.class);
        }

        @Test
        void noRepiteElValorRechazadoEnElMensaje() {
            String secreto = "ghp_tokenDePruebaQueNoDebeAparecer";

            assertThatThrownBy(() -> ResourceId.parse(secreto))
                    .isInstanceOf(DomainError.class)
                    .hasMessageNotContaining(secreto);
        }

        @Test
        void generaIdentificadoresDistintos() {
            assertThat(ResourceId.newId()).isNotEqualTo(ResourceId.newId());
        }
    }

    @Nested
    class DomainErrorTest {

        @Test
        void exponeUnConjuntoCerradoDeCodigos() {
            assertThat(DomainError.Code.values())
                    .containsExactly(
                            DomainError.Code.VALIDATION,
                            DomainError.Code.UNAUTHORIZED,
                            DomainError.Code.FORBIDDEN,
                            DomainError.Code.NOT_FOUND,
                            DomainError.Code.CONFLICT,
                            DomainError.Code.APPROVAL_STALE,
                            DomainError.Code.PATH_INVALID,
                            DomainError.Code.BLOCKED,
                            DomainError.Code.PROVIDER_UNAVAILABLE);
        }

        @Test
        void cadaFabricaFijaSuCodigo() {
            assertThat(DomainError.validation("v").code()).isEqualTo(DomainError.Code.VALIDATION);
            assertThat(DomainError.unauthorized("u").code()).isEqualTo(DomainError.Code.UNAUTHORIZED);
            assertThat(DomainError.forbidden("f").code()).isEqualTo(DomainError.Code.FORBIDDEN);
            assertThat(DomainError.conflict("c").code()).isEqualTo(DomainError.Code.CONFLICT);
            assertThat(DomainError.approvalStale("a").code()).isEqualTo(DomainError.Code.APPROVAL_STALE);
            assertThat(DomainError.pathInvalid("p").code()).isEqualTo(DomainError.Code.PATH_INVALID);
            assertThat(DomainError.blocked("b").code()).isEqualTo(DomainError.Code.BLOCKED);
            assertThat(DomainError.providerUnavailable("d").code())
                    .isEqualTo(DomainError.Code.PROVIDER_UNAVAILABLE);
        }

        @Test
        void notFoundIdentificaTipoYRecurso() {
            ResourceId id = ResourceId.parse("7f1d4f52-9b4e-4a1f-9a1a-5b4c3d2e1f00");

            DomainError error = DomainError.notFound("Project", id);

            assertThat(error.code()).isEqualTo(DomainError.Code.NOT_FOUND);
            assertThat(error.getMessage()).contains("Project").contains(id.asString());
        }

        @Test
        void exigeUnMensajeLegible() {
            assertThatThrownBy(() -> DomainError.conflict(" ")).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> DomainError.conflict(null)).isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void noEncadenaCausasQuePodrianArrastrarDetalleInterno() {
            assertThat(DomainError.forbidden("origen no autorizado")).hasNoCause();
        }
    }

    @Nested
    class ClockPortTest {

        @Test
        void elClockFijoEsDeterminista() {
            Instant instant = Instant.parse("2026-09-13T00:00:00Z");
            ClockPort clock = ClockPort.fixed(instant);

            assertThat(clock.now()).isEqualTo(instant);
            assertThat(clock.now()).isEqualTo(clock.now()).isEqualTo(instant);
        }

        @Test
        void elClockFijoExigeUnInstante() {
            assertThatThrownBy(() -> ClockPort.fixed(null)).isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void elClockDeSistemaAvanzaSinRetroceder() {
            ClockPort clock = ClockPort.systemUtc();

            Instant first = clock.now();
            Instant second = clock.now();

            assertThat(first).isNotNull();
            assertThat(second).isAfterOrEqualTo(first);
        }
    }
}
