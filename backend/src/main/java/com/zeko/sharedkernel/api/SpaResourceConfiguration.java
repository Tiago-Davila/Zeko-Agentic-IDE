package com.zeko.sharedkernel.api;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;
import org.springframework.web.servlet.resource.ResourceResolverChain;

@Configuration
public class SpaResourceConfiguration implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/" + "**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new SpaResourceResolver());
    }

    private static final class SpaResourceResolver extends PathResourceResolver {

        @Override
        protected Resource resolveResourceInternal(
                HttpServletRequest request,
                String requestPath,
                List<? extends Resource> locations,
                ResourceResolverChain chain) {

            Resource resource = super.resolveResourceInternal(request, requestPath, locations, chain);
            if (resource != null || !isSpaRoute(requestPath)) {
                return resource;
            }
            return super.resolveResourceInternal(request, "index.html", locations, chain);
        }

        private boolean isSpaRoute(String requestPath) {
            String path = requestPath.startsWith("/") ? requestPath.substring(1) : requestPath;
            return !path.startsWith("api/")
                    && !path.equals("api")
                    && !path.contains(".");
        }
    }
}
