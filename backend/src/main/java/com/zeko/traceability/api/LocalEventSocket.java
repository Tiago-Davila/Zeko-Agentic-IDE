package com.zeko.traceability.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class LocalEventSocket extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final Set<String> awaitingSubscription = ConcurrentHashMap.newKeySet();
    private final Map<String, Subscription> subscriptions = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public LocalEventSocket(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
        awaitingSubscription.add(session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        ClientFrame frame;
        try {
            frame = parse(message);
        } catch (IllegalArgumentException malformed) {
            reject(session);
            return;
        }
        if (awaitingSubscription.contains(session.getId()) && !"subscribe".equals(frame.type())) {
            reject(session);
            return;
        }

        if ("subscribe".equals(frame.type())) {
            try {
                subscriptions.put(session.getId(), Subscription.from(frame));
            } catch (IllegalArgumentException invalidSubscription) {
                reject(session);
                return;
            }
            awaitingSubscription.remove(session.getId());
            return;
        }
        if ("unsubscribe".equals(frame.type())) {
            subscriptions.remove(session.getId());
            return;
        }
        reject(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        awaitingSubscription.remove(session.getId());
        subscriptions.remove(session.getId());
        sessions.remove(session.getId());
    }

    public void publish(EventEnvelope event) {
        String payload = serialize(event);
        subscriptions.forEach((sessionId, subscription) -> sendToSubscriber(sessionId, subscription, event, payload));
    }

    private ClientFrame parse(TextMessage message) throws IOException {
        try {
            return objectMapper.readValue(message.getPayload(), ClientFrame.class);
        } catch (JsonProcessingException malformed) {
            throw new IllegalArgumentException("Frame WebSocket invalido", malformed);
        }
    }

    private void reject(WebSocketSession session) throws IOException {
        session.close(CloseStatus.POLICY_VIOLATION);
    }

    private String serialize(EventEnvelope event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException("No se pudo serializar el evento local", failure);
        }
    }

    private void sendToSubscriber(String sessionId, Subscription subscription, EventEnvelope event, String payload) {
        WebSocketSession session = sessions.get(sessionId);
        if (session == null || !session.isOpen() || !subscription.matches(event)) {
            return;
        }
        try {
            session.sendMessage(new TextMessage(payload));
        } catch (IOException failure) {
            sessions.remove(sessionId);
            subscriptions.remove(sessionId);
        }
    }

    private record ClientFrame(String type, String projectId, Set<String> executionIds, Set<String> taskIds) {
    }

    private record Subscription(UUID projectId, Set<UUID> executionIds, Set<UUID> taskIds) {

        static Subscription from(ClientFrame frame) {
            return new Subscription(
                    UUID.fromString(frame.projectId()), ids(frame.executionIds()), ids(frame.taskIds()));
        }

        boolean matches(EventEnvelope event) {
            return projectId.equals(event.projectId())
                    && matchesFilter(executionIds, event.payload().get("executionId"))
                    && matchesFilter(taskIds, event.payload().get("taskId"));
        }

        private static Set<UUID> ids(Set<String> rawIds) {
            if (rawIds == null) {
                return Set.of();
            }
            return rawIds.stream().map(UUID::fromString).collect(java.util.stream.Collectors.toUnmodifiableSet());
        }

        private static boolean matchesFilter(Set<UUID> filter, String value) {
            return filter.isEmpty() || value != null && filter.contains(UUID.fromString(value));
        }
    }
}
