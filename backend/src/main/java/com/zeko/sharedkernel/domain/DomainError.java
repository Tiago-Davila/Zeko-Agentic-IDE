package com.zeko.sharedkernel.domain;

public final class DomainError extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public enum Code {
        VALIDATION,
        UNAUTHORIZED,
        FORBIDDEN,
        NOT_FOUND,
        CONFLICT,
        APPROVAL_STALE,
        PATH_INVALID,
        BLOCKED,
        PROVIDER_UNAVAILABLE
    }

    private final Code code;

    private DomainError(Code code, String message) {
        super(requireMessage(message));
        this.code = code;
    }

    public static DomainError validation(String message) {
        return new DomainError(Code.VALIDATION, message);
    }

    public static DomainError unauthorized(String message) {
        return new DomainError(Code.UNAUTHORIZED, message);
    }

    public static DomainError forbidden(String message) {
        return new DomainError(Code.FORBIDDEN, message);
    }

    public static DomainError notFound(String resourceType, ResourceId id) {
        return new DomainError(Code.NOT_FOUND, resourceType + " " + id.asString() + " no existe");
    }

    public static DomainError conflict(String message) {
        return new DomainError(Code.CONFLICT, message);
    }

    public static DomainError approvalStale(String message) {
        return new DomainError(Code.APPROVAL_STALE, message);
    }

    public static DomainError pathInvalid(String message) {
        return new DomainError(Code.PATH_INVALID, message);
    }

    public static DomainError blocked(String message) {
        return new DomainError(Code.BLOCKED, message);
    }

    public static DomainError providerUnavailable(String message) {
        return new DomainError(Code.PROVIDER_UNAVAILABLE, message);
    }

    private static String requireMessage(String message) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("Un DomainError requiere un mensaje legible");
        }
        return message;
    }

    public Code code() {
        return code;
    }

    @Override
    public String toString() {
        return "DomainError[" + code + "] " + getMessage();
    }
}
