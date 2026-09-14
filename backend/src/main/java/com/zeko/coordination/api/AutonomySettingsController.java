package com.zeko.coordination.api;

import com.zeko.coordination.application.AutonomySettingsService;
import com.zeko.coordination.domain.AutonomyMode;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agent-instances/{instanceId}/autonomy-mode")
public class AutonomySettingsController {

    private final AutonomySettingsService settings;

    public AutonomySettingsController(AutonomySettingsService settings) {
        this.settings = settings;
    }

    @GetMapping
    public Response get(@PathVariable String instanceId) {
        ResourceId id = ResourceId.parse(instanceId);
        return new Response(id.asString(), settings.get(id));
    }

    @PutMapping
    public Response update(@PathVariable String instanceId, @RequestBody Input input) {
        ResourceId id = ResourceId.parse(instanceId);
        return new Response(id.asString(), settings.update(id, input.autonomyMode()));
    }

    public record Input(AutonomyMode autonomyMode) {
    }

    public record Response(String instanceId, AutonomyMode autonomyMode) {
    }
}
