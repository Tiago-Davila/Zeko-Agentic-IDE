package com.zeko.agentdesign.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public record TemplateVersion(
        ResourceId id,
        ResourceId templateId,
        int number,
        Map<String, Object> configuration,
        Instant createdAt) {

    public TemplateVersion {
        Objects.requireNonNull(id, "La version de plantilla requiere un identificador");
        Objects.requireNonNull(templateId, "La version de plantilla requiere una plantilla");
        if (number < 1) {
            throw DomainError.validation("El numero de version debe ser positivo");
        }
        configuration = immutableConfiguration(configuration);
        Objects.requireNonNull(createdAt, "La version de plantilla requiere fecha de creacion");
    }

    private static Map<String, Object> immutableConfiguration(Map<String, Object> source) {
        if (source == null) {
            throw DomainError.validation("La configuracion de plantilla es obligatoria");
        }

        Map<String, Object> copy = new LinkedHashMap<>();
        source.forEach((key, value) -> {
            if (key == null || key.isBlank()) {
                throw DomainError.validation("La configuracion de plantilla requiere claves no vacias");
            }
            copy.put(key, immutableValue(value));
        });
        return Map.copyOf(copy);
    }

    private static Object immutableValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> copy = new LinkedHashMap<>();
            map.forEach((key, nestedValue) -> {
                if (!(key instanceof String stringKey) || stringKey.isBlank()) {
                    throw DomainError.validation("La configuracion de plantilla requiere claves no vacias");
                }
                copy.put(stringKey, immutableValue(nestedValue));
            });
            return Map.copyOf(copy);
        }
        if (value instanceof List<?> list) {
            List<Object> copy = new ArrayList<>();
            for (Object item : list) {
                copy.add(immutableValue(item));
            }
            return List.copyOf(copy);
        }
        return value;
    }
}
