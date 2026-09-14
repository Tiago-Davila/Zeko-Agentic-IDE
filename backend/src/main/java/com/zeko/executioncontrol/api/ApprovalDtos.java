package com.zeko.executioncontrol.api;

import com.zeko.executioncontrol.application.ApprovalService.ApprovalView;
import com.zeko.executioncontrol.domain.ApprovalDecision;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Set;

public final class ApprovalDtos {

    private ApprovalDtos() {
    }

    public record DecisionInput(int actionRevision, ApprovalDecision.Decision decision, String reason) {
    }

    public record Response(
            String id,
            int actionRevision,
            String state,
            String actionProposalId,
            String agentInstanceId,
            String taskId,
            String executionId,
            String action,
            String resource,
            String scope,
            Set<String> effects,
            String reason) {

        public static Response from(ApprovalView view) {
            var approval = view.approval();
            var action = view.action();
            return new Response(approval.id().asString(), approval.actionRevision(), approval.state().name(),
                    action.id().asString(), id(action.agentInstanceId()), id(action.taskId()),
                    action.executionId().asString(),
                    action.type(), action.resource(), action.scope(), action.expectedEffects(), approval.reason());
        }

        private static String id(ResourceId value) {
            return value == null ? null : value.asString();
        }
    }
}
