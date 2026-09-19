package com.zeko.executioncontrol.api;

import com.zeko.executioncontrol.application.PermissionPolicyService;
import com.zeko.executioncontrol.domain.PermissionMode;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agent-instances/{instanceId}/permission-mode")
public class PermissionPolicyController {

    private final PermissionPolicyService policies;

    public PermissionPolicyController(PermissionPolicyService policies) {
        this.policies = policies;
    }

    @GetMapping
    public Response get(@PathVariable String instanceId) {
        return Response.from(policies.get(ResourceId.parse(instanceId)));
    }

    @PutMapping
    public Response update(@PathVariable String instanceId, @RequestBody Input input) {
        PermissionPolicy policy = policies.update(ResourceId.parse(instanceId), input.permissionMode(),
                input.autoApproveRules());
        return Response.from(policy);
    }

    public record Input(PermissionMode permissionMode, Set<String> autoApproveRules) {
    }

    public record Response(String instanceId, PermissionMode permissionMode, Set<String> autoApproveRules) {
        static Response from(PermissionPolicy policy) {
            return new Response(policy.runtimeSettingsId().asString(), policy.mode(), policy.autoApproveRules());
        }
    }
}
