package com.zeko.sharedkernel.application;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

public interface ClockPort {

    Instant now();

    static ClockPort systemUtc() {
        Clock clock = Clock.system(ZoneOffset.UTC);
        return clock::instant;
    }

    static ClockPort fixed(Instant instant) {
        if (instant == null) {
            throw new IllegalArgumentException("Un clock fijo requiere un instante");
        }
        return () -> instant;
    }
}
