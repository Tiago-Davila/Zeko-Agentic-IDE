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
    private static final String PROJECT_CATALOG_API = "com.zeko.projectcatalog.api";
    private static final String AGENT_DESIGN_API = "com.zeko.agentdesign.api";
    private static final String COORDINATION_API = "com.zeko.coordination.api";
    private static final String EXECUTION_CONTROL_API = "com.zeko.executioncontrol.api";
    private static final String TRACEABILITY_API = "com.zeko.traceability.api";

    @Autowired
    private ApplicationContext context;

    @Test
    void contextLoads() {
        assertThat(context).isNotNull();
    }

    @Test
    void exposesControllersOnlyFromImplementedModules() {
        assertThat(Arrays.stream(context.getBeanNamesForAnnotation(RestController.class))
                        .map(context::getType)
                        .filter(Objects::nonNull)
                        .map(Class::getPackageName)
                        .toList())
                        .containsOnly(SHARED_KERNEL_API, PROJECT_CATALOG_API, AGENT_DESIGN_API, COORDINATION_API,
                                EXECUTION_CONTROL_API, TRACEABILITY_API);
    }
}
