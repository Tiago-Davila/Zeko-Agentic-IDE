package com.zeko.sharedkernel.domain;

import java.util.UUID;

public record ResourceId(UUID value) {

    public ResourceId {
        if (value == null) {
            throw DomainError.validation("Un ResourceId requiere un UUID");
        }
    }

    public static ResourceId of(UUID value) {
        return new ResourceId(value);
    }

    public static ResourceId parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw DomainError.validation("Un ResourceId requiere un valor no vacio");
        }

        try {
            return new ResourceId(UUID.fromString(raw.trim()));
        } catch (IllegalArgumentException malformed) {
            throw DomainError.validation("ResourceId con formato invalido");
        }
    }

    public static ResourceId newId() {
        return new ResourceId(UUID.randomUUID());
    }

    public String asString() {
        return value.toString();
    }

    @Override
    public String toString() {
        return asString();
    }
}
