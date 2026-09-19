package com.zeko.traceability;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.traceability.application.SensitiveDataFilter;
import com.zeko.traceability.domain.SafeDetail;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SensitiveDataFilterTest {

    private final SensitiveDataFilter filter = new SensitiveDataFilter();

    @Test
    void separatesOperationalArgumentsFromPublishableDetails() {
        SafeDetail detail = filter.filter(Map.of(
                "workingDirectory", "/tmp/zeko",
                "apiToken", "synthetic-token",
                "arguments", "deploy --api-key sk_local_12345678"
        ));

        assertThat(detail.values()).containsEntry("workingDirectory", "/tmp/zeko")
                .containsEntry("apiToken", "[REDACTED]")
                .containsEntry("arguments", "deploy --api-key [REDACTED]");
        assertThat(detail.values().values()).noneMatch(value -> value.contains("synthetic-token"));
    }

    @Test
    void redactsKnownSecretsInOperationalErrors() {
        SafeDetail detail = filter.filterError("Provider rejected Authorization: Bearer ghp_12345678token");

        assertThat(detail.values()).containsEntry("message", "Provider rejected Authorization: Bearer [REDACTED]");
        assertThat(detail.values().values()).noneMatch(value -> value.contains("ghp_12345678token"));
    }

    @Test
    void preservesOrdinaryOperationalDetail() {
        SafeDetail detail = filter.filter(Map.of("resource", "backend/src/main/java/App.java"));

        assertThat(detail.values()).containsOnly(Map.entry("resource", "backend/src/main/java/App.java"));
    }
}
