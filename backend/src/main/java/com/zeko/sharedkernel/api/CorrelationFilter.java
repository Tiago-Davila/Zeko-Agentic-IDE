package com.zeko.sharedkernel.api;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Correlation-Id";
    public static final String ATTRIBUTE = "zeko.correlationId";

    private static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String correlationId = resolve(request.getHeader(HEADER));
        request.setAttribute(ATTRIBUTE, correlationId);
        response.setHeader(HEADER, correlationId);
        MDC.put(MDC_KEY, correlationId);

        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }

    public static String correlationIdOf(HttpServletRequest request) {
        Object attribute = request.getAttribute(ATTRIBUTE);
        return attribute instanceof String correlationId ? correlationId : ResourceId.newId().asString();
    }

    // Un identificador entrante solo se reutiliza si ya es un identificador valido.
    private static String resolve(String incoming) {
        if (incoming == null || incoming.isBlank()) {
            return ResourceId.newId().asString();
        }

        try {
            return ResourceId.parse(incoming).asString();
        } catch (DomainError malformed) {
            return ResourceId.newId().asString();
        }
    }
}
