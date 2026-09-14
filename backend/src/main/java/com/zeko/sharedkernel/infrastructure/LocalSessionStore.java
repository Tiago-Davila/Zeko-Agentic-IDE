package com.zeko.sharedkernel.infrastructure;

import com.zeko.sharedkernel.application.ClockPort;
import com.zeko.sharedkernel.application.LocalSessionPort;
import com.zeko.sharedkernel.domain.DomainError;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@EnableConfigurationProperties(LocalSessionStore.SessionProperties.class)
public class LocalSessionStore implements LocalSessionPort {

    private static final int TOKEN_BYTES = 32;
    private static final int TOKEN_CHARACTERS = 43;

    private final ClockPort clock;
    private final Duration timeToLive;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Instant> expiryByTokenHash = new ConcurrentHashMap<>();

    @Autowired
    public LocalSessionStore(SessionProperties properties) {
        this(ClockPort.systemUtc(), properties.ttl());
    }

    public LocalSessionStore(ClockPort clock, Duration timeToLive) {
        if (clock == null) {
            throw new IllegalArgumentException("LocalSessionStore requiere un clock");
        }
        if (timeToLive == null || timeToLive.isZero() || timeToLive.isNegative()) {
            throw new IllegalArgumentException("zeko.session.ttl debe ser positivo");
        }
        this.clock = clock;
        this.timeToLive = timeToLive;
    }

    @ConfigurationProperties("zeko.session")
    public record SessionProperties(Duration ttl) {

        public SessionProperties {
            if (ttl == null || ttl.isZero() || ttl.isNegative()) {
                throw DomainError.validation("zeko.session.ttl debe ser positivo");
            }
        }
    }

    @Override
    public IssuedSession issue() {
        purgeExpired();

        byte[] raw = new byte[TOKEN_BYTES];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Instant expiresAt = clock.now().plus(timeToLive);

        expiryByTokenHash.put(hash(token), expiresAt);
        return new IssuedSession(token, expiresAt);
    }

    @Override
    public Optional<ActiveSession> validate(String token) {
        if (!hasTokenShape(token)) {
            return Optional.empty();
        }

        String tokenHash = hash(token);
        Instant expiresAt = expiryByTokenHash.get(tokenHash);

        if (expiresAt == null) {
            return Optional.empty();
        }

        if (!clock.now().isBefore(expiresAt)) {
            expiryByTokenHash.remove(tokenHash, expiresAt);
            return Optional.empty();
        }

        return Optional.of(new ActiveSession(expiresAt));
    }

    @Override
    public void invalidate(String token) {
        if (hasTokenShape(token)) {
            expiryByTokenHash.remove(hash(token));
        }
    }

    @Override
    public Duration timeToLive() {
        return timeToLive;
    }

    public int activeCount() {
        purgeExpired();
        return expiryByTokenHash.size();
    }

    private void purgeExpired() {
        Instant now = clock.now();
        expiryByTokenHash.values().removeIf(expiresAt -> !now.isBefore(expiresAt));
    }

    private static boolean hasTokenShape(String token) {
        if (token == null || token.length() != TOKEN_CHARACTERS) {
            return false;
        }

        return token.chars().allMatch(character -> Character.isLetterOrDigit(character)
                || character == '-'
                || character == '_');
    }

    // Solo se guarda la huella; el token en claro nunca queda en memoria del store.
    private static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 no esta disponible en esta JVM", unavailable);
        }
    }
}
