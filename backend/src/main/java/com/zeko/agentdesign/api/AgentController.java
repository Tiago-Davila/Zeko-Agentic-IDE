package com.zeko.agentdesign.api;

import com.zeko.agentdesign.application.AgentService;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AgentController {

    private final AgentService agents;

    public AgentController(AgentService agents) {
        this.agents = agents;
    }

    @GetMapping("/projects/{projectId}/agent-templates")
    public List<AgentDtos.TemplateResponse> templates(@PathVariable String projectId) {
        return agents.templates(ResourceId.parse(projectId)).stream().map(AgentDtos::template).toList();
    }

    @PostMapping("/projects/{projectId}/agent-templates")
    public ResponseEntity<AgentDtos.TemplateResponse> createTemplate(
            @PathVariable String projectId, @RequestBody AgentDtos.TemplateInput input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(AgentDtos.template(
                agents.createOrVersion(ResourceId.parse(projectId), input.name(), input.configuration())));
    }

    @GetMapping("/projects/{projectId}/agent-instances")
    public List<AgentDtos.InstanceResponse> instances(@PathVariable String projectId) {
        return agents.instances(ResourceId.parse(projectId)).stream().map(AgentDtos::instance).toList();
    }

    @PostMapping("/projects/{projectId}/agent-instances")
    public ResponseEntity<AgentDtos.InstanceResponse> createInstance(
            @PathVariable String projectId, @RequestBody AgentDtos.InstanceInput input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(AgentDtos.instance(agents.createInstance(
                ResourceId.parse(projectId), ResourceId.parse(input.templateVersionId()), input.identity(),
                input.context())));
    }

    @GetMapping("/agent-instances/{instanceId}")
    public AgentDtos.InstanceResponse instance(@PathVariable String instanceId) {
        return AgentDtos.instance(agents.instance(ResourceId.parse(instanceId)));
    }

    @PostMapping("/agent-instances/{instanceId}/template-updates")
    public AgentDtos.InstanceResponse update(
            @PathVariable String instanceId, @RequestBody AgentDtos.UpdateInput input) {
        return AgentDtos.instance(agents.decideUpdate(
                ResourceId.parse(instanceId), ResourceId.parse(input.templateVersionId()), input.decision()));
    }
}
