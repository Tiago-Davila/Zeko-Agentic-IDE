package com.zeko.agentdesign.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;

public record AgentSkillBinding(ResourceId id, ResourceId instanceId, ResourceId skillId, State state) {

    public enum State {
        ACTIVE,
        DISABLED
    }

    public AgentSkillBinding {
        Objects.requireNonNull(id, "El vinculo de skill requiere un identificador");
        Objects.requireNonNull(instanceId, "El vinculo de skill requiere una instancia");
        Objects.requireNonNull(skillId, "El vinculo de skill requiere una skill");
        Objects.requireNonNull(state, "El vinculo de skill requiere un estado");
    }

    public static AgentSkillBinding bind(ResourceId id, AgentInstance instance, SkillDefinition skill) {
        Objects.requireNonNull(instance, "La instancia es obligatoria");
        Objects.requireNonNull(skill, "La skill es obligatoria");
        if (!instance.projectId().equals(skill.projectId())) {
            throw DomainError.validation("La skill y la instancia deben pertenecer al mismo proyecto");
        }
        if (skill.scope() != SkillDefinition.Scope.PROJECT) {
            throw DomainError.validation("Solo una skill de proyecto puede vincularse a una instancia");
        }
        return new AgentSkillBinding(id, instance.id(), skill.id(), State.ACTIVE);
    }
}
