package com.zeko.agentdesign;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.agentdesign.domain.AgentInstance;
import com.zeko.agentdesign.domain.AgentSkillBinding;
import com.zeko.agentdesign.domain.SkillDefinition;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SkillBindingTest {

    @Test
    void bindsOnlyAnExistingProjectSkillOwnedByTheInstancesProject() {
        ResourceId projectId = ResourceId.newId();
        AgentInstance instance = instance(projectId);
        SkillDefinition skill = skill(projectId, SkillDefinition.Scope.PROJECT);

        AgentSkillBinding binding = AgentSkillBinding.bind(ResourceId.newId(), instance, skill);

        assertThat(binding.instanceId()).isEqualTo(instance.id());
        assertThat(binding.skillId()).isEqualTo(skill.id());
        assertThat(binding.state()).isEqualTo(AgentSkillBinding.State.ACTIVE);
    }

    @Test
    void rejectsCrossProjectSkillBindings() {
        AgentInstance instance = instance(ResourceId.newId());

        SkillDefinition foreignSkill = skill(ResourceId.newId(), SkillDefinition.Scope.PROJECT);

        assertThatThrownBy(() -> AgentSkillBinding.bind(ResourceId.newId(), instance, foreignSkill))
                .isInstanceOf(DomainError.class)
                .extracting(error -> ((DomainError) error).code())
                .isEqualTo(DomainError.Code.VALIDATION);
    }

    @Test
    void doesNotExposePermissionOrToolAuthorityOnSkillsOrBindings() {
        assertThat(SkillDefinition.class.getRecordComponents()).extracting(component -> component.getName())
                .doesNotContain("permission", "permissions", "tools", "authority");
        assertThat(AgentSkillBinding.class.getRecordComponents()).extracting(component -> component.getName())
                .doesNotContain("permission", "permissions", "tools", "authority");
    }

    private static AgentInstance instance(ResourceId projectId) {
        return new AgentInstance(
                ResourceId.newId(), projectId, ResourceId.newId(), 1, "reviewer", Map.of(), "READY");
    }

    private static SkillDefinition skill(ResourceId projectId, SkillDefinition.Scope scope) {
        return new SkillDefinition(
                ResourceId.newId(), projectId, "Code review", Path.of("skills", "review", "SKILL.md"), "abc123", scope);
    }
}
