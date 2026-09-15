package com.zeko.executioncontrol.application;

import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.Approval;
import com.zeko.executioncontrol.domain.PermissionDecision;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.executioncontrol.domain.Worktree;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class AuthorizedActionDispatcher {
  private final ApprovalRepository approvals;
  private final PermissionPolicyService policies;
  private final WorktreeRepository worktrees;
  private final CapabilityRegistry capabilities;
  private final ExecutionService executions;

  public AuthorizedActionDispatcher(ApprovalRepository approvals,
                                    PermissionPolicyService policies,
                                    WorktreeRepository worktrees,
                                    CapabilityRegistry capabilities,
                                    ExecutionService executions) {
    this.approvals = approvals;
    this.policies = policies;
    this.worktrees = worktrees;
    this.capabilities = capabilities;
    this.executions = executions;
  }

  public LocalActionResult dispatch(ActionProposal action,
                                    ResourceId approvalId, ResourceId taskId) {
    Objects.requireNonNull(action, "La accion es obligatoria");
    Approval approval =
        approvals.findApproval(approvalId)
            .orElseThrow(() -> DomainError.notFound("Approval", approvalId));
    if (!approval.actionProposalId().equals(action.id()) ||
        approval.actionRevision() != action.revision() ||
        !approval.executable()) {
      throw DomainError.approvalStale("La accion no tiene aprobacion vigente");
    }
    if (action.agentInstanceId() != null) {
      PermissionPolicy policy = policies.get(action.agentInstanceId());
      PermissionDecision decision = policy.evaluate(action);
      if (decision.denied() ||
          decision.requiresApproval() && !approval.executable()) {
        throw DomainError.forbidden(
            "La politica de permiso no autoriza la accion");
      }
    }
    Worktree worktree = worktrees.findByTask(taskId).orElseThrow(
        () -> DomainError.blocked("La task no tiene worktree"));
    if (worktree.state() != Worktree.State.ACTIVE ||
        !action.executionId().equals(worktree.ownerExecutionId())) {
      throw DomainError.blocked("La ejecucion no es dueña del worktree");
    }
    LocalCapability capability = capability(action);
    executions.identifyProvider(action.executionId(), capability);
    try {
      return capabilities.require(capability).execute(action);
    } catch (DomainError error) {
      if (error.code() == DomainError.Code.PROVIDER_UNAVAILABLE) {
        executions.markProviderUnavailable(action.executionId(), capability);
      }
      throw error;
    }
  }

  private static LocalCapability capability(ActionProposal action) {
    if (action.resource().startsWith("docker:")) {
      return LocalCapability.DOCKER;
    }
    if (action.resource().startsWith("ollama:")) {
      return LocalCapability.OLLAMA;
    }
    return switch (action.type()) {
      case "READ_LOCAL", "WRITE_LOCAL" -> LocalCapability.FILESYSTEM;
      case "EXECUTE_LOCAL" -> LocalCapability.TERMINAL;
      default ->
        throw DomainError.forbidden(
            "La accion no tiene adaptador local autorizado");
    };
  }
}
