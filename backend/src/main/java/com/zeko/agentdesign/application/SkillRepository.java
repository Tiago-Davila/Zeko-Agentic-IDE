package com.zeko.agentdesign.application;

import com.zeko.agentdesign.domain.AgentSkillBinding;
import com.zeko.agentdesign.domain.SkillDefinition;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Optional;

public interface SkillRepository {
    void save(SkillDefinition skill);
    Optional<SkillDefinition> findById(ResourceId skillId);
    List<SkillDefinition> findByProjectId(ResourceId projectId);
    void saveBinding(AgentSkillBinding binding);
    List<AgentSkillBinding> findBindingsByInstanceId(ResourceId instanceId);
}
