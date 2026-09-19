package com.zeko.agentdesign;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.agentdesign.domain.AgentInstance;
import com.zeko.agentdesign.domain.AgentTemplate;
import com.zeko.agentdesign.domain.TemplateUpdateDecision;
import com.zeko.agentdesign.domain.TemplateVersion;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AgentTemplateTest {

    @Test
    void keepsTemplateVersionsAndNestedConfigurationImmutable() {
        ResourceId templateId = ResourceId.newId();
        Map<String, Object> source = Map.of("model", "local", "limits", Map.of("tokens", 2_000));
        TemplateVersion first = version(templateId, 1, source);
        AgentTemplate template = new AgentTemplate(templateId, ResourceId.newId(), "Planner", List.of(first));

        assertThat(template.currentVersion()).isEqualTo(first);
        assertThat(template.currentVersion().configuration()).containsEntry("model", "local");
        assertThatThrownBy(() -> template.currentVersion().configuration().put("model", "remote"))
                .isInstanceOf(UnsupportedOperationException.class);
        Map<?, ?> limits = (Map<?, ?>) template.currentVersion().configuration().get("limits");
        assertThatThrownBy(() -> mutate(limits))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void requiresConsecutiveVersionsOwnedByTheTemplate() {
        ResourceId templateId = ResourceId.newId();

        assertThatThrownBy(() -> new AgentTemplate(
                templateId,
                ResourceId.newId(),
                "Planner",
                List.of(version(templateId, 2, Map.of()))))
                .isInstanceOf(DomainError.class)
                .extracting(error -> ((DomainError) error).code())
                .isEqualTo(DomainError.Code.CONFLICT);
    }

    @Test
    void keepsInstanceIdentityContextAndStateSeparateFromTemplateConfiguration() {
        AgentInstance instance = new AgentInstance(
                ResourceId.newId(),
                ResourceId.newId(),
                ResourceId.newId(),
                1,
                "backend-reviewer",
                Map.of("repository", "backend"),
                "READY");

        AgentInstance updated = instance.selectTemplateVersion(2);

        assertThat(updated).usingRecursiveComparison().ignoringFields("selectedTemplateVersion").isEqualTo(instance);
        assertThat(updated.selectedTemplateVersion()).isEqualTo(2);
        assertThat(AgentInstance.class.getRecordComponents()).extracting(component -> component.getName())
                .doesNotContain("configuration", "overrides", "templateOverrides");
    }

    @Test
    void acceptedDecisionOnlyAppliesTheSelectedVersionToFutureExecutions() {
        TemplateUpdateDecision accepted = new TemplateUpdateDecision(
                ResourceId.newId(),
                ResourceId.newId(),
                1,
                2,
                TemplateUpdateDecision.Outcome.ACCEPTED,
                Instant.parse("2026-09-14T12:00:00Z"));
        TemplateUpdateDecision rejected = new TemplateUpdateDecision(
                ResourceId.newId(),
                ResourceId.newId(),
                1,
                2,
                TemplateUpdateDecision.Outcome.REJECTED,
                Instant.parse("2026-09-14T12:00:00Z"));

        assertThat(accepted.appliesToFutureExecutions()).isTrue();
        assertThat(rejected.appliesToFutureExecutions()).isFalse();
    }

    private static TemplateVersion version(ResourceId templateId, int number, Map<String, Object> configuration) {
        return new TemplateVersion(
                ResourceId.newId(), templateId, number, configuration, Instant.parse("2026-09-14T12:00:00Z"));
    }

    @SuppressWarnings("unchecked")
    private static void mutate(Map<?, ?> values) {
        ((Map<Object, Object>) values).put("tokens", 1);
    }
}
