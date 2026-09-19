package com.zeko.agentdesign.application;

import com.zeko.agentdesign.domain.AgentInstance;
import com.zeko.agentdesign.domain.AgentTemplate;
import com.zeko.agentdesign.domain.TemplateUpdateDecision;
import com.zeko.agentdesign.domain.TemplateVersion;
import com.zeko.projectcatalog.application.ProjectService;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class AgentService {

    private final AgentRepository agents;
    private final ProjectService projects;

    public AgentService(AgentRepository agents, ProjectService projects) {
        this.agents = agents;
        this.projects = projects;
    }

    public List<AgentTemplate> templates(ResourceId projectId) {
        projects.find(projectId);
        return agents.findTemplatesByProjectId(projectId);
    }

    public AgentTemplate createOrVersion(ResourceId projectId, String name, Map<String, Object> configuration) {
        AgentTemplate existing = templates(projectId).stream()
                .filter(template -> template.name().equals(name == null ? null : name.trim()))
                .findFirst()
                .orElse(null);
        if (existing == null) {
            ResourceId templateId = ResourceId.newId();
            TemplateVersion first = version(templateId, 1, configuration);
            AgentTemplate created = new AgentTemplate(templateId, projectId, name, List.of(first));
            agents.saveTemplate(created);
            return created;
        }
        int current = existing.currentVersion().number();
        TemplateVersion next = version(existing.id(), current + 1, configuration);
        agents.appendVersion(existing.id(), current, next);
        return existing.append(next);
    }

    public List<AgentInstance> instances(ResourceId projectId) {
        projects.find(projectId);
        return agents.findInstancesByProjectId(projectId);
    }

    public AgentInstance instance(ResourceId instanceId) {
        return agents.findInstanceById(instanceId).orElseThrow(() -> DomainError.notFound("AgentInstance", instanceId));
    }

    public AgentInstance createInstance(
            ResourceId projectId, ResourceId versionId, String identity, Map<String, String> context) {
        TemplateVersion selected = selectedVersion(projectId, versionId);
        AgentInstance created = new AgentInstance(
                ResourceId.newId(), projectId, selected.templateId(), selected.number(), identity, context, "READY");
        agents.saveInstance(created);
        return created;
    }

    public AgentInstance decideUpdate(ResourceId instanceId, ResourceId versionId, String decision) {
        AgentInstance instance = instance(instanceId);
        TemplateVersion proposed = selectedVersion(instance.projectId(), versionId);
        if (!instance.templateId().equals(proposed.templateId())) {
            throw DomainError.validation("La version no pertenece a la plantilla de la instancia");
        }
        TemplateUpdateDecision.Outcome outcome = decision(decision);
        AgentInstance updated = outcome == TemplateUpdateDecision.Outcome.ACCEPTED
                ? instance.selectTemplateVersion(proposed.number())
                : instance;
        agents.recordDecision(new TemplateUpdateDecision(
                ResourceId.newId(), instanceId, instance.selectedTemplateVersion(), proposed.number(), outcome,
                Instant.now()));
        if (updated != instance) {
            agents.saveInstance(updated);
        }
        return updated;
    }

    private TemplateVersion selectedVersion(ResourceId projectId, ResourceId versionId) {
        return templates(projectId).stream()
                .flatMap(template -> template.versions().stream())
                .filter(version -> version.id().equals(versionId))
                .findFirst()
                .orElseThrow(() -> DomainError.notFound("TemplateVersion", versionId));
    }

    private static TemplateUpdateDecision.Outcome decision(String value) {
        if ("ACCEPT".equals(value)) {
            return TemplateUpdateDecision.Outcome.ACCEPTED;
        }
        if ("REJECT".equals(value)) {
            return TemplateUpdateDecision.Outcome.REJECTED;
        }
        throw DomainError.validation("La decision de actualizacion no es valida");
    }

    private static TemplateVersion version(ResourceId templateId, int number, Map<String, Object> configuration) {
        return new TemplateVersion(ResourceId.newId(), templateId, number, configuration, Instant.now());
    }
}
