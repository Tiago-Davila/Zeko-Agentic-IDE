package com.zeko;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest
class ZekoApplicationTest {

    private static final String SHARED_KERNEL_API = "com.zeko.sharedkernel.api";

    @Autowired
    private ApplicationContext context;

    @Test
    void contextLoads() {
        assertThat(context).isNotNull();
    }

    // El MVP aun no expone endpoints de features: solo los del shared kernel local.
    @Test
    void exposesNoFeatureControllers() {
        assertThat(Arrays.stream(context.getBeanNamesForAnnotation(RestController.class))
                        .map(context::getType)
                        .filter(Objects::nonNull)
                        .map(Class::getPackageName)
                        .filter(packageName -> !SHARED_KERNEL_API.equals(packageName))
                        .toList())
                .isEmpty();
    }
}
