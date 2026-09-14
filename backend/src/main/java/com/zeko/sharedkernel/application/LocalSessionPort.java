package com.zeko.sharedkernel.application;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

public interface LocalSessionPort {

    record IssuedSession(String token, Instant expiresAt) {

        // El token no se imprime: no debe llegar a un log, traza ni mensaje de error.
        @Override
        public String toString() {
            return "IssuedSession[expiresAt=" + expiresAt + "]";
        }
    }

    record ActiveSession(Instant expiresAt) {
    }

    IssuedSession issue();

    Optional<ActiveSession> validate(String token);

    void invalidate(String token);

    Duration timeToLive();
}
