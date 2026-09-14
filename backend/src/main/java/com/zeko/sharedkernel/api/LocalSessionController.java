package com.zeko.sharedkernel.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.zeko.sharedkernel.application.LocalSessionPort;
import com.zeko.sharedkernel.domain.DomainError;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/session")
public class LocalSessionController {

    private final LocalSessionPort sessions;

    public LocalSessionController(LocalSessionPort sessions) {
        this.sessions = sessions;
    }

    public record LocalSessionView(Instant expiresAt, @JsonProperty("loopbackOnly") boolean loopbackOnly) {

        static LocalSessionView of(Instant expiresAt) {
            return new LocalSessionView(expiresAt, true);
        }
    }

    @PostMapping("/bootstrap")
    public ResponseEntity<LocalSessionView> bootstrap() {
        LocalSessionPort.IssuedSession issued = sessions.issue();

        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, cookie(issued).toString())
                .body(LocalSessionView.of(issued.expiresAt()));
    }

    @GetMapping
    public LocalSessionView current(HttpServletRequest request) {
        Object attribute = request.getAttribute(LocalSessionFilter.ATTRIBUTE);

        if (attribute instanceof LocalSessionPort.ActiveSession session) {
            return LocalSessionView.of(session.expiresAt());
        }

        throw DomainError.unauthorized("Sesion local ausente o expirada");
    }

    // El token viaja solo en la cookie efimera; nunca en el cuerpo de la respuesta.
    private ResponseCookie cookie(LocalSessionPort.IssuedSession issued) {
        return ResponseCookie.from(LocalSessionFilter.COOKIE_NAME, issued.token())
                .httpOnly(true)
                .secure(false)
                .path("/api")
                .sameSite("Strict")
                .maxAge(sessions.timeToLive())
                .build();
    }
}
