package com.zeko.traceability.application;

import com.zeko.traceability.domain.SafeDetail;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

public final class SensitiveDataFilter {

    private static final String REDACTED = "[REDACTED]";

    private static final Pattern BEARER_TOKEN = Pattern.compile("(?i)(bearer\\s+)[^\\s,;]+");

    private static final Pattern CLI_SECRET = Pattern.compile(
            "(?i)(--(?:api[-_]?key|token|password|secret)(?:=|\\s+))[^\\s,;]+"
    );

    private static final Pattern PROVIDER_TOKEN = Pattern.compile(
            "\\b(?:sk|ghp)_[A-Za-z0-9_-]{8,}\\b|\\bgithub_pat_[A-Za-z0-9_-]{8,}\\b"
    );

    public SafeDetail filter(Map<String, ?> operationalDetails) {
        Objects.requireNonNull(operationalDetails, "Los detalles operativos son obligatorios");
        Map<String, String> publishable = new LinkedHashMap<>();
        operationalDetails.forEach((key, value) -> publishable.put(key, sanitize(key, value)));
        return SafeDetail.of(publishable);
    }

    public SafeDetail filterError(String operationalError) {
        Objects.requireNonNull(operationalError, "El error operativo es obligatorio");
        return SafeDetail.of(Map.of("message", sanitizeValue(operationalError)));
    }

    private String sanitize(String key, Object value) {
        if (isSensitiveKey(key)) {
            return REDACTED;
        }
        return sanitizeValue(String.valueOf(value));
    }

    private boolean isSensitiveKey(String key) {
        if (key == null) {
            return true;
        }
        String normalized = key.replaceAll("[^A-Za-z0-9]", "").toLowerCase();
        return normalized.contains("password")
                || normalized.contains("secret")
                || normalized.contains("token")
                || normalized.contains("authorization")
                || normalized.contains("credential")
                || normalized.contains("apikey")
                || normalized.contains("cookie");
    }

    private String sanitizeValue(String value) {
        String bearerSafe = BEARER_TOKEN.matcher(value).replaceAll("$1" + REDACTED);
        String commandSafe = CLI_SECRET.matcher(bearerSafe).replaceAll("$1" + REDACTED);
        return PROVIDER_TOKEN.matcher(commandSafe).replaceAll(REDACTED);
    }
}
