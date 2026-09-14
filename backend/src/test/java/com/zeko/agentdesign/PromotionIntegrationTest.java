package com.zeko.agentdesign;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.agentdesign.application.PromotionService;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class PromotionIntegrationTest {
    @TempDir static Path localDataDir;
    @Autowired private PromotionService promotions;
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("promotion.db").toString());
    }
    @Test void requiresAnExistingResourceForAnExplicitPromotion() {
        assertThatThrownBy(() -> promotions.promoteTemplate(ResourceId.newId(), "PROMOTE"))
                .isInstanceOf(DomainError.class);
    }
}
