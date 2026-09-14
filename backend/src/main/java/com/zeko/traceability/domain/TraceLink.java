package com.zeko.traceability.domain;

import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.Objects;

public record TraceLink(
        ResourceId id,
        String sourceType,
        ResourceId sourceId,
        String targetType,
        ResourceId targetId,
        String relation,
        Instant createdAt) {

    public TraceLink {
        Objects.requireNonNull(id, "El enlace requiere un identificador");
        sourceType = requireLabel(sourceType, "origen");
        Objects.requireNonNull(sourceId, "El enlace requiere un identificador de origen");
        targetType = requireLabel(targetType, "destino");
        Objects.requireNonNull(targetId, "El enlace requiere un identificador de destino");
        relation = requireLabel(relation, "relacion");
        Objects.requireNonNull(createdAt, "El enlace requiere fecha de creacion");
    }

    private static String requireLabel(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("El enlace requiere " + field);
        }
        return value.trim();
    }
}
