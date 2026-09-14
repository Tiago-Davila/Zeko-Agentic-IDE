package com.zeko.traceability.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.zeko.traceability.domain.SafeDetail;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public final class EventEnvelope {

    private final UUID eventId;
    private final String eventType;
    private final Instant occurredAt;
    private final UUID correlationId;
    private final long sequence;
    private final UUID projectId;
    private final Map<String, String> payload;

    private EventEnvelope(
            UUID eventId,
            String eventType,
            Instant occurredAt,
            UUID correlationId,
            long sequence,
            UUID projectId,
            SafeDetail payload) {

        this.eventId = Objects.requireNonNull(eventId, "El evento requiere identificador");
        this.eventType = requireText(eventType, "tipo");
        this.occurredAt = Objects.requireNonNull(occurredAt, "El evento requiere fecha");
        this.correlationId = Objects.requireNonNull(correlationId, "El evento requiere correlacion");
        if (sequence < 1) {
            throw new IllegalArgumentException("La secuencia del evento debe ser positiva");
        }
        this.sequence = sequence;
        this.projectId = Objects.requireNonNull(projectId, "El evento requiere proyecto");
        this.payload = Map.copyOf(Objects.requireNonNull(payload, "El evento requiere detalle seguro").values());
    }

    public static EventEnvelope of(
            UUID eventId,
            String eventType,
            Instant occurredAt,
            UUID correlationId,
            long sequence,
            UUID projectId,
            SafeDetail payload) {

        return new EventEnvelope(eventId, eventType, occurredAt, correlationId, sequence, projectId, payload);
    }

    @JsonProperty("eventId")
    public UUID eventId() {
        return eventId;
    }

    @JsonProperty("eventType")
    public String eventType() {
        return eventType;
    }

    @JsonProperty("occurredAt")
    public Instant occurredAt() {
        return occurredAt;
    }

    @JsonProperty("correlationId")
    public UUID correlationId() {
        return correlationId;
    }

    @JsonProperty("sequence")
    public long sequence() {
        return sequence;
    }

    @JsonProperty("projectId")
    public UUID projectId() {
        return projectId;
    }

    @JsonProperty("payload")
    public Map<String, String> payload() {
        return payload;
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("El evento requiere " + field);
        }
        return value.trim();
    }
}
