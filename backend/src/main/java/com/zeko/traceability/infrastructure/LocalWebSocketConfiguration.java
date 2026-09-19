package com.zeko.traceability.infrastructure;

import com.zeko.sharedkernel.application.LocalSessionPort;
import jakarta.servlet.http.Cookie;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Configuration
@EnableWebSocket
public class LocalWebSocketConfiguration implements WebSocketConfigurer {

    private static final String EVENTS_PATH = "/api/ws/events";
    private static final String LOCAL_SESSION_ATTRIBUTE = "zeko.localSession";
    private static final String SESSION_COOKIE = "zeko_local_session";

    private final WebSocketHandler eventSocket;
    private final LocalSessionPort sessions;

    public LocalWebSocketConfiguration(
            @Qualifier("localEventSocket") WebSocketHandler eventSocket,
            LocalSessionPort sessions) {
        this.eventSocket = eventSocket;
        this.sessions = sessions;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(eventSocket, EVENTS_PATH).addInterceptors(new LocalHandshakeInterceptor(sessions));
    }

    public static final class LocalHandshakeInterceptor implements HandshakeInterceptor {

        private static final Set<String> LOOPBACK_HOSTS = Set.of("127.0.0.1", "localhost", "::1");

        private final LocalSessionPort sessions;

        public LocalHandshakeInterceptor(LocalSessionPort sessions) {
            this.sessions = sessions;
        }

        @Override
        public boolean beforeHandshake(
                ServerHttpRequest request,
                ServerHttpResponse response,
                WebSocketHandler handler,
                Map<String, Object> attributes) {

            if (!(request instanceof ServletServerHttpRequest servletRequest)) {
                return false;
            }
            if (!isLoopback(servletRequest) || !isAllowedOrigin(servletRequest) || !hasSession(servletRequest)) {
                return false;
            }
            attributes.put(LOCAL_SESSION_ATTRIBUTE, Boolean.TRUE);
            return true;
        }

        @Override
        public void afterHandshake(
                ServerHttpRequest request,
                ServerHttpResponse response,
                WebSocketHandler handler,
                Exception exception) {
        }

        private boolean hasSession(ServletServerHttpRequest request) {
            Cookie[] cookies = request.getServletRequest().getCookies();
            if (cookies == null) {
                return false;
            }
            return Arrays.stream(cookies)
                    .filter(cookie -> SESSION_COOKIE.equals(cookie.getName()))
                    .map(Cookie::getValue)
                    .findFirst()
                    .flatMap(sessions::validate)
                    .isPresent();
        }

        private static boolean isLoopback(ServletServerHttpRequest request) {
            String host = request.getServletRequest().getHeader("Host");
            String remoteAddress = request.getServletRequest().getRemoteAddr();
            return isLoopbackAddress(remoteAddress) && host != null && isLoopbackHost(host);
        }

        private static boolean isAllowedOrigin(ServletServerHttpRequest request) {
            String origin = request.getServletRequest().getHeader("Origin");
            if (origin == null) {
                return false;
            }
            try {
                URI parsed = URI.create(origin);
                return parsed.getUserInfo() == null
                        && parsed.getQuery() == null
                        && parsed.getFragment() == null
                        && (parsed.getPath() == null || parsed.getPath().isEmpty())
                        && "http".equalsIgnoreCase(parsed.getScheme())
                        && LOOPBACK_HOSTS.contains(normalizeHost(parsed.getHost()));
            } catch (IllegalArgumentException malformed) {
                return false;
            }
        }

        private static boolean isLoopbackHost(String header) {
            try {
                URI parsed = URI.create("http://" + header.trim().toLowerCase(Locale.ROOT));
                return parsed.getUserInfo() == null && LOOPBACK_HOSTS.contains(normalizeHost(parsed.getHost()));
            } catch (IllegalArgumentException malformed) {
                return false;
            }
        }

        private static boolean isLoopbackAddress(String address) {
            try {
                return InetAddress.getByName(address).isLoopbackAddress();
            } catch (UnknownHostException unresolved) {
                return false;
            }
        }

        private static String normalizeHost(String host) {
            return host == null ? null : host.toLowerCase(Locale.ROOT).replace("[", "").replace("]", "");
        }
    }
}
