package com.zeko.agentdesign.api;

import com.zeko.agentdesign.application.SkillService;
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
public class SkillController {
    private final SkillService skills;
    public SkillController(SkillService skills) {
        this.skills = skills;
    }
    @GetMapping("/projects/{projectId}/skills")
    public List<SkillDtos.SkillResponse> list(@PathVariable String projectId) {
        return skills.list(ResourceId.parse(projectId)).stream().map(SkillDtos::skill).toList();
    }
    @PostMapping("/projects/{projectId}/skills")
    public ResponseEntity<SkillDtos.SkillResponse> register(
            @PathVariable String projectId, @RequestBody SkillDtos.SkillInput input) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(SkillDtos.skill(skills.register(ResourceId.parse(projectId), input.name(), input.skillPath())));
    }
    @PostMapping("/agent-instances/{instanceId}/skill-bindings")
    public ResponseEntity<SkillDtos.BindingResponse> bind(
            @PathVariable String instanceId, @RequestBody SkillDtos.BindingInput input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(SkillDtos.binding(
                skills.bind(ResourceId.parse(instanceId), ResourceId.parse(input.skillDefinitionId()))));
    }
}
