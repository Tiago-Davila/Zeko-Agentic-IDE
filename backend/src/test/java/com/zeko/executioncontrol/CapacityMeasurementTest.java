package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CapacityMeasurementTest {

    @Test
    void registraElPerfilLocalSinInferirCapacidadNoMedida() {
        CapacitySample sample = CapacitySample.capture(new Workload(2, 2, 1_024));

        assertThat(sample.availableProcessors()).isPositive();
        assertThat(sample.maxMemoryBytes()).isPositive();
        assertThat(sample.workload().agents()).isEqualTo(2);
        assertThat(sample.workload().repositories()).isEqualTo(2);
        assertThat(sample.completedAgentRuns()).isZero();
        assertThat(sample.capacityClaim()).isEmpty();
    }

    private record Workload(int agents, int repositories, int repositoryKilobytes) {

        private Workload {
            if (agents < 1 || repositories < 1 || repositoryKilobytes < 1) {
                throw new IllegalArgumentException("La carga de capacidad debe ser positiva");
            }
        }
    }

    private record CapacitySample(
            int availableProcessors,
            long maxMemoryBytes,
            Workload workload,
            int completedAgentRuns,
            String capacityClaim) {

        static CapacitySample capture(Workload workload) {
            Runtime runtime = Runtime.getRuntime();
            return new CapacitySample(
                    runtime.availableProcessors(), runtime.maxMemory(), workload, 0, "");
        }
    }
}
