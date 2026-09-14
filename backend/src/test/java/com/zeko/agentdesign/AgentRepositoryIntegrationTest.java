package com.zeko.agentdesign;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.agentdesign.application.AgentRepository;
import com.zeko.agentdesign.domain.AgentInstance;
import com.zeko.agentdesign.domain.AgentTemplate;
import com.zeko.agentdesign.domain.TemplateUpdateDecision;
import com.zeko.agentdesign.domain.TemplateVersion;
import com.zeko.projectcatalog.application.ProjectRepository;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class AgentRepositoryIntegrationTest {

    @TempDir
    static Path localDataDir;

    @Autowired
    private AgentRepository agents;

    @Autowired
    private ProjectRepository projects;

    @DynamicPropertySource
    static void localDatabase(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("agents.db").toString());
    }

    @Test
    void preservesImmutableTemplateVersionsWithOptimisticConcurrency() {
        ResourceId projectId = project();
        ResourceId templateId = ResourceId.newId();
        TemplateVersion first = version(templateId, 1, Map.of("model", "small"));
        agents.saveTemplate(new AgentTemplate(templateId, projectId, "Planner", List.of(first)));
        TemplateVersion second = version(templateId, 2, Map.of("model", "large"));

        agents.appendVersion(templateId, 1, second);

        assertThat(agents.findTemplateById(templateId)).hasValueSatisfying(template ->
                assertThat(template.versions()).containsExactly(first, second));
        assertThatThrownBy(() -> agents.appendVersion(templateId, 1, version(templateId, 2, Map.of("model", "other"))))
                .isInstanceOf(DomainError.class)
                .extracting(error -> ((DomainError) error).code())
                .isEqualTo(DomainError.Code.CONFLICT);
        assertThat(agents.findTemplateById(templateId).orElseThrow().versions()).containsExactly(first, second);
    }

    @Test
    void reopensInstancesAndTheirVersionUpdateDecisions() {
        ResourceId projectId = project();
        ResourceId templateId = ResourceId.newId();
        agents.saveTemplate(new AgentTemplate(
                templateId, projectId, "Reviewer", List.of(version(templateId, 1, Map.of()))));
        AgentInstance instance = new AgentInstance(
                ResourceId.newId(), projectId, templateId, 1, "reviewer", Map.of("repository", "backend"), "READY");
        agents.saveInstance(instance);
        AgentInstance updated = instance.selectTemplateVersion(2);
        agents.appendVersion(templateId, 1, version(templateId, 2, Map.of("model", "large")));
        agents.saveInstance(updated);
        TemplateUpdateDecision decision = new TemplateUpdateDecision(
                ResourceId.newId(), instance.id(), 1, 2, TemplateUpdateDecision.Outcome.ACCEPTED, timestamp());
        agents.recordDecision(decision);

        assertThat(agents.findInstanceById(instance.id())).contains(updated);
        assertThat(agents.findInstancesByProjectId(projectId)).containsExactly(updated);
        assertThat(agents.findDecisionsByInstanceId(instance.id())).containsExactly(decision);
    }

    private ResourceId project() {
        ResourceId projectId = ResourceId.newId();
        projects.save(Project.create(
                projectId, "Zeko " + projectId.asString(), Path.of("workspace", projectId.asString())));
        return projectId;
    }

    private static TemplateVersion version(ResourceId templateId, int number, Map<String, Object> configuration) {
        return new TemplateVersion(ResourceId.newId(), templateId, number, configuration, timestamp());
    }

    private static Instant timestamp() {
        return Instant.parse("2026-09-14T15:00:00Z");
    }
}
