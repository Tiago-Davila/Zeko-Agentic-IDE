package com.zeko.agentdesign.api;

import com.zeko.agentdesign.domain.AgentSkillBinding;
import com.zeko.agentdesign.domain.SkillDefinition;

public final class SkillDtos {
    private SkillDtos() {
    }

    public record SkillInput(String name, String skillPath) {
    }

    public record BindingInput(String skillDefinitionId) {
    }

    public record SkillResponse(String id, String projectId, String name, String skillPath, String scope) {
    }

    public record BindingResponse(String id, String agentInstanceId, String skillDefinitionId, String state) {
    }

    public static SkillResponse skill(SkillDefinition skill) {
        return new SkillResponse(
                skill.id().asString(), skill.projectId().asString(), skill.name(), skill.skillPath().toString(),
                skill.scope().name());
    }

    public static BindingResponse binding(AgentSkillBinding binding) {
        return new BindingResponse(
                binding.id().asString(), binding.instanceId().asString(), binding.skillId().asString(),
                binding.state().name());
    }
}
