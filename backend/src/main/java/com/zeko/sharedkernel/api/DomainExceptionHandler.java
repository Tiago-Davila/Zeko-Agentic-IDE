package com.zeko.sharedkernel.api;

import com.zeko.sharedkernel.domain.DomainError;
import jakarta.servlet.http.HttpServletRequest;
import java.util.EnumMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class DomainExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(DomainExceptionHandler.class);

    private static final String INTERNAL_CODE = "internal";
    private static final String INTERNAL_MESSAGE = "Error interno local; revisar los logs por correlationId";
    private static final String INVALID_BODY_MESSAGE = "El cuerpo de la solicitud no es valido";

    private static final Map<DomainError.Code, HttpStatus> STATUS_BY_CODE = statusByCode();
    private static final Map<DomainError.Code, String> WIRE_BY_CODE = wireByCode();

    @ExceptionHandler(DomainError.class)
    public ResponseEntity<ErrorResponse> handleDomainError(DomainError error, HttpServletRequest request) {
        HttpStatus status = STATUS_BY_CODE.getOrDefault(error.code(), HttpStatus.INTERNAL_SERVER_ERROR);
        String wireCode = WIRE_BY_CODE.getOrDefault(error.code(), INTERNAL_CODE);

        return ResponseEntity.status(status)
                .body(ErrorResponse.of(wireCode, error.getMessage(), correlationId(request)));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<ErrorResponse> handleInvalidRequest(Exception invalid, HttpServletRequest request) {
        LOGGER.debug("Solicitud local invalida: {}", invalid.getClass().getSimpleName());

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.of(
                        WIRE_BY_CODE.get(DomainError.Code.VALIDATION), INVALID_BODY_MESSAGE, correlationId(request)));
    }

    @ExceptionHandler({NoHandlerFoundException.class, NoResourceFoundException.class})
    public ResponseEntity<ErrorResponse> handleUnknownRoute(Exception missing, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of(
                        WIRE_BY_CODE.get(DomainError.Code.NOT_FOUND),
                        "Recurso local no encontrado",
                        correlationId(request)));
    }

    // Lo inesperado se registra con su correlationId y nunca viaja al cliente.
    @ExceptionHandler(Throwable.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Throwable failure, HttpServletRequest request) {
        String correlationId = correlationId(request);
        LOGGER.error("Fallo local no controlado con correlationId {}", correlationId, failure);

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of(INTERNAL_CODE, INTERNAL_MESSAGE, correlationId));
    }

    private static String correlationId(HttpServletRequest request) {
        return CorrelationFilter.correlationIdOf(request);
    }

    private static Map<DomainError.Code, HttpStatus> statusByCode() {
        Map<DomainError.Code, HttpStatus> mapping = new EnumMap<>(DomainError.Code.class);
        mapping.put(DomainError.Code.VALIDATION, HttpStatus.BAD_REQUEST);
        mapping.put(DomainError.Code.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
        mapping.put(DomainError.Code.FORBIDDEN, HttpStatus.FORBIDDEN);
        mapping.put(DomainError.Code.NOT_FOUND, HttpStatus.NOT_FOUND);
        mapping.put(DomainError.Code.CONFLICT, HttpStatus.CONFLICT);
        mapping.put(DomainError.Code.APPROVAL_STALE, HttpStatus.CONFLICT);
        mapping.put(DomainError.Code.PATH_INVALID, HttpStatus.UNPROCESSABLE_ENTITY);
        mapping.put(DomainError.Code.BLOCKED, HttpStatus.LOCKED);
        mapping.put(DomainError.Code.PROVIDER_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
        return Map.copyOf(mapping);
    }

    private static Map<DomainError.Code, String> wireByCode() {
        Map<DomainError.Code, String> mapping = new EnumMap<>(DomainError.Code.class);
        mapping.put(DomainError.Code.VALIDATION, "validation");
        mapping.put(DomainError.Code.UNAUTHORIZED, "unauthorized");
        mapping.put(DomainError.Code.FORBIDDEN, "forbidden");
        mapping.put(DomainError.Code.NOT_FOUND, "not-found");
        mapping.put(DomainError.Code.CONFLICT, "conflict");
        mapping.put(DomainError.Code.APPROVAL_STALE, "approval-stale");
        mapping.put(DomainError.Code.PATH_INVALID, "path-invalid");
        mapping.put(DomainError.Code.BLOCKED, "blocked");
        mapping.put(DomainError.Code.PROVIDER_UNAVAILABLE, "provider-unavailable");
        return Map.copyOf(mapping);
    }
}
