package com.zeko.sharedkernel.api;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        String code,
        String message,
        String correlationId,
        String provider,
        String knownState,
        Boolean retryAllowed) {

    public ErrorResponse {
        code = requireText(code, "code");
        message = requireText(message, "message");
        correlationId = requireText(correlationId, "correlationId");
    }

    public static ErrorResponse of(String code, String message, String correlationId) {
        return new ErrorResponse(code, message, correlationId, null, null, null);
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("ErrorResponse." + field + " es obligatorio");
        }
        return value;
    }
}
