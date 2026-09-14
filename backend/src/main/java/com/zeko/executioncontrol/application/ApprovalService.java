package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.Approval;
import com.zeko.executioncontrol.domain.ApprovalDecision;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import com.zeko.traceability.application.TraceRecorder;
import com.zeko.traceability.domain.SafeDetail;
import com.zeko.traceability.domain.TraceLink;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ApprovalService {

    private final ApprovalRepository approvals;
    private final TraceRecorder traces;

    @Autowired
    public ApprovalService(ApprovalRepository approvals, TraceRecorder traces) {
        this.approvals = Objects.requireNonNull(approvals, "El repositorio de aprobaciones es obligatorio");
        this.traces = traces;
    }

    public ApprovalService(ApprovalRepository approvals) {
        this(approvals, null);
    }

    public ApprovalView view(ResourceId approvalId) {
        Approval approval = approvals.findApproval(approvalId)
                .orElseThrow(() -> DomainError.notFound("Approval", approvalId));
        ActionProposal action = approvals.findAction(approval.actionProposalId(), approval.actionRevision())
                .orElseThrow(() -> DomainError.notFound("ActionRevision", approval.actionProposalId()));
        return new ApprovalView(approval, action);
    }

    public ApprovalView decide(ResourceId approvalId, ApprovalDecision decision) {
        Approval updated = approvals.decide(approvalId, decision);
        if (traces != null) {
            traces.record(new TraceLink(ResourceId.newId(), "Approval", updated.id(), "ActionProposal",
                    updated.actionProposalId(), "DECISION", Instant.now()),
                    SafeDetail.of(Map.of("state", updated.state().name(),
                            "revision", Integer.toString(updated.actionRevision()))));
        }
        ActionProposal action = approvals.findAction(updated.actionProposalId(), updated.actionRevision())
                .orElseThrow(() -> DomainError.notFound("ActionRevision", updated.actionProposalId()));
        return new ApprovalView(updated, action);
    }

    public record ApprovalView(Approval approval, ActionProposal action) {
    }
}
