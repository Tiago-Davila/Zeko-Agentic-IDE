package com.zeko.agentdesign.api;

import com.zeko.agentdesign.domain.AgentInstance;
import com.zeko.agentdesign.domain.AgentTemplate;
import java.util.Map;

public final class AgentDtos {

    private AgentDtos() {
    }

    public record TemplateInput(String name, Map<String, Object> configuration) {
    }

    public record InstanceInput(String templateVersionId, String identity, Map<String, String> context) {
    }

    public record UpdateInput(String templateVersionId, String decision) {
    }

    public record TemplateResponse(String id, String projectId, String name, int version) {
    }

    public record InstanceResponse(
            String id,
            String projectId,
            String templateId,
            int selectedTemplateVersion,
            String identity,
            Map<String, String> context,
            String state) {
    }

    public static TemplateResponse template(AgentTemplate template) {
        return new TemplateResponse(
                template.id().asString(), template.projectId().asString(), template.name(),
                template.currentVersion().number());
    }

    public static InstanceResponse instance(AgentInstance instance) {
        return new InstanceResponse(
                instance.id().asString(), instance.projectId().asString(), instance.templateId().asString(),
                instance.selectedTemplateVersion(), instance.identity(), instance.context(), instance.state());
    }
}
