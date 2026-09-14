package com.zeko.executioncontrol.api;

import com.zeko.executioncontrol.application.ApprovalService;
import com.zeko.executioncontrol.domain.ApprovalDecision;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/approvals")
public class ApprovalController {

    private final ApprovalService approvals;

    public ApprovalController(ApprovalService approvals) {
        this.approvals = approvals;
    }

    @GetMapping("/{approvalId}")
    public ApprovalDtos.Response get(@PathVariable String approvalId) {
        return ApprovalDtos.Response.from(approvals.view(ResourceId.parse(approvalId)));
    }

    @PostMapping("/{approvalId}/decisions")
    public ApprovalDtos.Response decide(
            @PathVariable String approvalId, @RequestBody ApprovalDtos.DecisionInput input) {
        if (input == null || input.decision() == null) {
            throw DomainError.validation("La decision de aprobacion es obligatoria");
        }
        ApprovalDecision decision = new ApprovalDecision(input.decision(), input.actionRevision(),
                ResourceId.newId(), input.reason());
        return ApprovalDtos.Response.from(approvals.decide(ResourceId.parse(approvalId), decision));
    }
}
