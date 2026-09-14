package com.zeko.agentdesign.application;

import com.zeko.agentdesign.domain.AgentInstance;
import com.zeko.agentdesign.domain.AgentSkillBinding;
import com.zeko.agentdesign.domain.SkillDefinition;
import com.zeko.projectcatalog.application.ProjectService;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class SkillService {
    private final SkillRepository skills;
    private final AgentService agents;
    private final ProjectService projects;
    private final SkillContentStore files;

    public SkillService(SkillRepository skills, AgentService agents, ProjectService projects, SkillContentStore files) {
        this.skills = skills;
        this.agents = agents;
        this.projects = projects;
        this.files = files;
    }

    public List<SkillDefinition> list(ResourceId projectId) {
        projects.find(projectId);
        return skills.findByProjectId(projectId);
    }

    public SkillDefinition register(ResourceId projectId, String name, String skillPath) {
        Path path = Path.of(skillPath);
        String fingerprint = files.fingerprint(projects.find(projectId).rootPath(), path);
        SkillDefinition skill = new SkillDefinition(
                ResourceId.newId(), projectId, name, path, fingerprint, SkillDefinition.Scope.PROJECT);
        skills.save(skill);
        return skill;
    }

    public AgentSkillBinding bind(ResourceId instanceId, ResourceId skillId) {
        AgentInstance instance = agents.instance(instanceId);
        SkillDefinition skill = skills.findById(skillId)
                .orElseThrow(() -> DomainError.notFound("SkillDefinition", skillId));
        AgentSkillBinding binding = AgentSkillBinding.bind(ResourceId.newId(), instance, skill);
        skills.saveBinding(binding);
        return binding;
    }
}
