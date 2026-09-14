package com.zeko;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

@SpringBootTest
class ZekoApplicationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void contextLoads() {
        assertThat(context).isNotNull();
    }

    // El arranque del MVP no expone endpoints ni entidades de features todavia.
    @Test
    void exposesNoFeatureControllers() {
        assertThat(context.getBeanNamesForAnnotation(org.springframework.web.bind.annotation.RestController.class))
                .isEmpty();
    }
}
