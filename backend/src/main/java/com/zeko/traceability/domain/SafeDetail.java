package com.zeko.traceability.domain;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public record SafeDetail(Map<String, String> values) {

    public SafeDetail {
        Objects.requireNonNull(values, "Los detalles seguros son obligatorios");
        Map<String, String> copy = new LinkedHashMap<>();
        values.forEach((key, value) -> copy.put(requireKey(key), requireValue(value)));
        values = Collections.unmodifiableMap(copy);
    }

    public static SafeDetail of(Map<String, String> values) {
        return new SafeDetail(values);
    }

    private static String requireKey(String key) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Cada detalle seguro requiere una clave");
        }
        return key;
    }

    private static String requireValue(String value) {
        if (value == null) {
            throw new IllegalArgumentException("Cada detalle seguro requiere un valor");
        }
        return value;
    }
}
