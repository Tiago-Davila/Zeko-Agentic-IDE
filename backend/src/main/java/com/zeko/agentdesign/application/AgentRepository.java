package com.zeko.agentdesign.application;

import com.zeko.agentdesign.domain.AgentInstance;
import com.zeko.agentdesign.domain.AgentTemplate;
import com.zeko.agentdesign.domain.TemplateUpdateDecision;
import com.zeko.agentdesign.domain.TemplateVersion;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Optional;

public interface AgentRepository {

    void saveTemplate(AgentTemplate template);

    void appendVersion(ResourceId templateId, int expectedCurrentVersion, TemplateVersion version);

    Optional<AgentTemplate> findTemplateById(ResourceId templateId);

    List<AgentTemplate> findTemplatesByProjectId(ResourceId projectId);

    void saveInstance(AgentInstance instance);

    Optional<AgentInstance> findInstanceById(ResourceId instanceId);

    List<AgentInstance> findInstancesByProjectId(ResourceId projectId);

    void recordDecision(TemplateUpdateDecision decision);

    List<TemplateUpdateDecision> findDecisionsByInstanceId(ResourceId instanceId);
}
