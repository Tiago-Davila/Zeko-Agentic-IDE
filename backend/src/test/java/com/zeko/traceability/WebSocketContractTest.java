package com.zeko.traceability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeko.sharedkernel.application.LocalSessionPort;
import com.zeko.traceability.api.EventEnvelope;
import com.zeko.traceability.api.LocalEventSocket;
import com.zeko.traceability.application.SensitiveDataFilter;
import com.zeko.traceability.infrastructure.LocalWebSocketConfiguration.LocalHandshakeInterceptor;
import java.time.Instant;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;

class WebSocketContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void publishesOnlySafeEventsToMatchingProjectSubscription() throws Exception {
        LocalEventSocket socket = new LocalEventSocket(objectMapper);
        WebSocketSession session = openSession("valid-session");
        UUID projectId = UUID.randomUUID();
        EventEnvelope event = safeEvent(projectId);

        socket.afterConnectionEstablished(session);
        socket.handleMessage(session, new TextMessage("{\"type\":\"subscribe\",\"projectId\":\"" + projectId + "\"}"));
        socket.publish(event);

        verify(session).sendMessage(any(TextMessage.class));
        String serialized = objectMapper.writeValueAsString(event);
        assertThat(serialized).contains("\"payload\"").doesNotContain("synthetic-secret");
    }

    @Test
    void rejectsACommandBeforeTheRequiredSubscription() throws Exception {
        LocalEventSocket socket = new LocalEventSocket(objectMapper);
        WebSocketSession session = openSession("invalid-session");

        socket.afterConnectionEstablished(session);
        String command = "{\"type\":\"approve\",\"projectId\":\"" + UUID.randomUUID() + "\"}";
        socket.handleMessage(session, new TextMessage(command));

        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void doesNotPublishOutsideExecutionScope() throws Exception {
        LocalEventSocket socket = new LocalEventSocket(objectMapper);
        WebSocketSession session = openSession("scoped-session");
        UUID projectId = UUID.randomUUID();

        socket.afterConnectionEstablished(session);
        socket.handleMessage(session, new TextMessage("{\"type\":\"subscribe\",\"projectId\":\"" + projectId
                + "\",\"executionIds\":[\"" + UUID.randomUUID() + "\"]}"));
        socket.publish(safeEvent(projectId));

        verify(session, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void requiresLoopbackOriginAndAnActiveLocalSession() {
        LocalHandshakeInterceptor interceptor = new LocalHandshakeInterceptor(activeSessions());
        MockHttpServletRequest request = localRequest("http://127.0.0.1:5173");
        Map<String, Object> attributes = new java.util.HashMap<>();

        boolean accepted = interceptor.beforeHandshake(
                new ServletServerHttpRequest(request),
                mock(ServerHttpResponse.class),
                mock(WebSocketHandler.class),
                attributes);

        assertThat(accepted).isTrue();
        assertThat(attributes).containsEntry("zeko.localSession", Boolean.TRUE);
    }

    @Test
    void rejectsAHandshakeFromANonLocalOrigin() {
        LocalHandshakeInterceptor interceptor = new LocalHandshakeInterceptor(activeSessions());
        MockHttpServletRequest request = localRequest("https://example.test");

        boolean accepted = interceptor.beforeHandshake(
                new ServletServerHttpRequest(request),
                mock(ServerHttpResponse.class),
                mock(WebSocketHandler.class),
                Map.of());

        assertThat(accepted).isFalse();
    }

    private WebSocketSession openSession(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        return session;
    }

    private EventEnvelope safeEvent(UUID projectId) {
        return EventEnvelope.of(
                UUID.randomUUID(),
                "execution.effect.recorded",
                Instant.parse("2026-09-14T12:00:00Z"),
                UUID.randomUUID(),
                1,
                projectId,
                new SensitiveDataFilter().filter(Map.of("token", "synthetic-secret")));
    }

    private MockHttpServletRequest localRequest(String origin) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("Host", "127.0.0.1:8080");
        request.addHeader("Origin", origin);
        request.setCookies(new Cookie("zeko_local_session", "valid"));
        return request;
    }

    private LocalSessionPort activeSessions() {
        return new LocalSessionPort() {
            @Override
            public IssuedSession issue() {
                throw new UnsupportedOperationException();
            }

            @Override
            public Optional<ActiveSession> validate(String token) {
                return "valid".equals(token) ? Optional.of(new ActiveSession(Instant.MAX)) : Optional.empty();
            }

            @Override
            public void invalidate(String token) {
            }

            @Override
            public Duration timeToLive() {
                return Duration.ofMinutes(30);
            }
        };
    }
}
