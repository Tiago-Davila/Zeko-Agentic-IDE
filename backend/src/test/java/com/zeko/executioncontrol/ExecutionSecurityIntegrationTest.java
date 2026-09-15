package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.zeko.executioncontrol.application.ApprovalRepository;
import com.zeko.executioncontrol.application.AuthorizedActionDispatcher;
import com.zeko.executioncontrol.application.CapabilityRegistry;
import com.zeko.executioncontrol.application.LocalActionAdapter;
import com.zeko.executioncontrol.application.LocalCapability;
import com.zeko.executioncontrol.application.PermissionPolicyService;
import com.zeko.executioncontrol.application.WorktreeRepository;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.Approval;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ExecutionSecurityIntegrationTest {

    @Test
    void unaAprobacionInvalidadaNoPuedeAlcanzarElAdaptadorLocal() {
        ResourceId actionId = ResourceId.newId();
        ResourceId executionId = ResourceId.newId();
        ResourceId approvalId = ResourceId.newId();
        ActionProposal action = new ActionProposal(
                actionId, executionId, "WRITE_LOCAL", "file:local", "archivo", Set.of("escritura"), 2);
        Approval invalidated = new Approval(
                approvalId, actionId, 1, Approval.State.INVALIDATED, null, null, "accion revisada", 2);
        ApprovalRepository approvals = mock(ApprovalRepository.class);
        WorktreeRepository worktrees = mock(WorktreeRepository.class);
        LocalActionAdapter adapter = mock(LocalActionAdapter.class);
        when(approvals.findApproval(approvalId)).thenReturn(Optional.of(invalidated));
        when(adapter.capability()).thenReturn(LocalCapability.FILESYSTEM);

        AuthorizedActionDispatcher dispatcher = dispatcher(approvals, worktrees, adapter);

        assertThatThrownBy(() -> dispatcher.dispatch(action, approvalId, ResourceId.newId()))
                .isInstanceOfSatisfying(DomainError.class,
                        error -> org.assertj.core.api.Assertions.assertThat(error.code())
                                .isEqualTo(DomainError.Code.APPROVAL_STALE));

        verifyNoInteractions(worktrees, adapter);
    }

    private AuthorizedActionDispatcher dispatcher(
            ApprovalRepository approvals, WorktreeRepository worktrees, LocalActionAdapter adapter) {
        return new AuthorizedActionDispatcher(
                approvals,
                mock(PermissionPolicyService.class),
                worktrees,
                new CapabilityRegistry(List.of(adapter)));
    }
}
