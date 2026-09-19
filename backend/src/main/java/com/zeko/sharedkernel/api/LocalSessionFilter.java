package com.zeko.sharedkernel.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeko.sharedkernel.application.LocalSessionPort;
import com.zeko.sharedkernel.domain.DomainError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class LocalSessionFilter extends OncePerRequestFilter {

    public static final String ATTRIBUTE = "zeko.localSession";
    public static final String COOKIE_NAME = "zeko_local_session";

    private static final String API_PREFIX = "/api/";
    private static final String BOOTSTRAP_PATH = "/api/session/bootstrap";
    private static final Set<String> LOOPBACK_HOSTS = Set.of("127.0.0.1", "localhost", "::1");
    private static final Set<String> ALLOWED_ORIGIN_SCHEMES = Set.of("http", "https");

    private final LocalSessionPort sessions;
    private final ObjectMapper objectMapper;

    public LocalSessionFilter(LocalSessionPort sessions, ObjectMapper objectMapper) {
        this.sessions = sessions;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(API_PREFIX);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        try {
            requireLoopbackClient(request);
            requireLocalHostHeader(request);
            requireAllowedOrigin(request);

            if (!BOOTSTRAP_PATH.equals(request.getRequestURI())) {
                request.setAttribute(ATTRIBUTE, requireActiveSession(request));
            }
        } catch (DomainError rejected) {
            reject(request, response, rejected);
            return;
        }

        chain.doFilter(request, response);
    }

    public static Optional<String> sessionCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }

        return Arrays.stream(cookies)
                .filter(cookie -> COOKIE_NAME.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst();
    }

    private LocalSessionPort.ActiveSession requireActiveSession(HttpServletRequest request) {
        return sessionCookie(request)
                .flatMap(sessions::validate)
                .orElseThrow(() -> DomainError.unauthorized("Sesion local ausente o expirada"));
    }

    private void requireLoopbackClient(HttpServletRequest request) {
        String remote = request.getRemoteAddr();
        if (remote == null || !isLoopback(remote)) {
            throw DomainError.forbidden("El backend local solo atiende clientes de loopback");
        }
    }

    private void requireLocalHostHeader(HttpServletRequest request) {
        String host = request.getHeader("Host");
        if (host == null) {
            return;
        }

        if (hostNameOf(host).filter(LOOPBACK_HOSTS::contains).isEmpty()) {
            throw DomainError.forbidden("Host no autorizado para el backend local");
        }
    }

    // Una peticion sin Origin es de navegacion directa o de un cliente local, no de otro sitio.
    private void requireAllowedOrigin(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (origin == null) {
            return;
        }

        try {
            URI parsed = URI.create(origin);
            String scheme = parsed.getScheme();
            String originHost = normalizeHost(parsed.getHost());

            if (scheme == null
                    || !ALLOWED_ORIGIN_SCHEMES.contains(scheme.toLowerCase(Locale.ROOT))
                    || originHost == null
                    || !LOOPBACK_HOSTS.contains(originHost)
                    || parsed.getRawUserInfo() != null
                    || parsed.getRawQuery() != null
                    || parsed.getRawFragment() != null
                    || (parsed.getRawPath() != null && !parsed.getRawPath().isEmpty())
                    || !isValidPort(parsed.getPort())) {
                throw DomainError.forbidden("Origen no autorizado para el backend local");
            }
        } catch (IllegalArgumentException malformed) {
            throw DomainError.forbidden("Origen no autorizado para el backend local");
        }
    }

    private static Optional<String> hostNameOf(String hostHeader) {
        String value = hostHeader.trim().toLowerCase(Locale.ROOT);
        if (value.isEmpty()) {
            return Optional.empty();
        }

        try {
            URI parsed = URI.create("http://" + value);
            String host = normalizeHost(parsed.getHost());
            boolean exactAuthority = parsed.getRawUserInfo() == null
                    && parsed.getRawQuery() == null
                    && parsed.getRawFragment() == null
                    && (parsed.getRawPath() == null || parsed.getRawPath().isEmpty());

            return exactAuthority && host != null && isValidPort(parsed.getPort())
                    ? Optional.of(host)
                    : Optional.empty();
        } catch (IllegalArgumentException malformed) {
            return Optional.empty();
        }
    }

    private static String normalizeHost(String host) {
        if (host == null) {
            return null;
        }

        String normalized = host.toLowerCase(Locale.ROOT);
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            return normalized.substring(1, normalized.length() - 1);
        }
        return normalized;
    }

    private static boolean isValidPort(int port) {
        return port == -1 || port >= 1 && port <= 65_535;
    }

    private static boolean isLoopback(String remoteAddress) {
        if (LOOPBACK_HOSTS.contains(normalizeHost(remoteAddress))) {
            return true;
        }

        try {
            return InetAddress.getByName(remoteAddress).isLoopbackAddress();
        } catch (UnknownHostException unresolved) {
            return false;
        }
    }

    private void reject(HttpServletRequest request, HttpServletResponse response, DomainError rejected)
            throws IOException {

        HttpStatus status = rejected.code() == DomainError.Code.UNAUTHORIZED
                ? HttpStatus.UNAUTHORIZED
                : HttpStatus.FORBIDDEN;
        String code = rejected.code() == DomainError.Code.UNAUTHORIZED ? "unauthorized" : "forbidden";

        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(
                response.getOutputStream(),
                ErrorResponse.of(code, rejected.getMessage(), CorrelationFilter.correlationIdOf(request)));
    }
}
