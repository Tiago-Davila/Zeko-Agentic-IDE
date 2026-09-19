package com.zeko.executioncontrol.api;

import com.zeko.executioncontrol.application.ApprovalService;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}/approvals")
public class ProjectApprovalController {

    private final ApprovalService approvals;

    public ProjectApprovalController(ApprovalService approvals) {
        this.approvals = approvals;
    }

    @GetMapping
    public List<ApprovalDtos.Response> pending(@PathVariable String projectId) {
        return approvals.pending(ResourceId.parse(projectId)).stream()
                .map(ApprovalDtos.Response::from)
                .toList();
    }
}
