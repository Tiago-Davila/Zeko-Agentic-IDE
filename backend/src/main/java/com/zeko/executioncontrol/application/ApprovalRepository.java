package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.Approval;
import com.zeko.executioncontrol.domain.ApprovalDecision;
import com.zeko.executioncontrol.domain.PermissionMode;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface ApprovalRepository {

    void savePolicy(PermissionPolicy policy);

    Optional<PermissionPolicy> findPolicy(ResourceId runtimeSettingsId);

    void saveAction(ActionProposal proposal);

    Optional<ActionProposal> findAction(ResourceId actionId, int revision);

    void saveApproval(Approval approval);

    Optional<Approval> findApproval(ResourceId approvalId);

    List<Approval> findPendingByProject(ResourceId projectId);

    Approval decide(ResourceId approvalId, ApprovalDecision decision);

    void invalidatePending(ResourceId actionProposalId, int currentRevision);

    PermissionPolicy defaultPolicy(ResourceId runtimeSettingsId, PermissionMode mode, Set<String> rules);
}
