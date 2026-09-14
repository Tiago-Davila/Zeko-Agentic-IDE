package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.Approval;
import com.zeko.executioncontrol.domain.ApprovalDecision;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Set;
import java.util.List;
import org.junit.jupiter.api.Test;

class ApprovalRevisionTest {

    @Test
    void changingARevisionInvalidatesPendingApproval() {
        ActionProposal original = action(1);
        Approval pending = Approval.pending(original.id(), original.revision());
        ActionProposal revised = original.revise(original.type(), "src/changed.txt", original.scope(),
                original.workingDirectory(), original.arguments(), original.networkTarget(), original.expectedEffects(),
                original.classification());

        assertThat(pending.invalidateFor(revised).state()).isEqualTo(Approval.State.INVALIDATED);
        assertThatThrownBy(() -> pending.decide(new ApprovalDecision(
                ApprovalDecision.Decision.APPROVE, revised.revision(), ResourceId.newId(), "tarde")))
                .isInstanceOf(DomainError.class)
                .extracting(error -> ((DomainError) error).code())
                .isEqualTo(DomainError.Code.APPROVAL_STALE);
    }

    @Test
    void duplicateDecisionCannotEnableACompletedApproval() {
        Approval approved = Approval.pending(ResourceId.newId(), 1)
                .decide(new ApprovalDecision(ApprovalDecision.Decision.APPROVE, 1, ResourceId.newId(), "ok"));
        assertThatThrownBy(() -> approved.decide(new ApprovalDecision(
                ApprovalDecision.Decision.APPROVE, 1, ResourceId.newId(), "otra")))
                .isInstanceOf(DomainError.class);
    }

    @Test
    void proposalMetadataRedactsCredentialLikeArguments() {
        ActionProposal proposal = new ActionProposal(ResourceId.newId(), ResourceId.newId(), null, null,
                "EXECUTE_LOCAL", "tool", "worktree", ".", List.of("--token", "secret-value"), "", Set.of("read"),
                com.zeko.executioncontrol.domain.PermissionPolicy.ActionCategory.EXECUTE_LOCAL, 1);
        assertThat(proposal.arguments()).containsExactly("--token", "[REDACTED]");
    }

    private static ActionProposal action(int revision) {
        return new ActionProposal(ResourceId.newId(), ResourceId.newId(), "READ_LOCAL", "README.md", "worktree",
                Set.of("read"), revision);
    }
}
