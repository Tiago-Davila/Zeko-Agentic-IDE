package com.zeko.executioncontrol.domain;

import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.time.Instant;
import java.util.Objects;

public record Approval(
        ResourceId id,
        ResourceId actionProposalId,
        int actionRevision,
        State state,
        ResourceId decidedBy,
        Instant decidedAt,
        String reason,
        long version) {

    public enum State {
        PENDING,
        APPROVED,
        DENIED,
        INVALIDATED
    }

    public Approval {
        Objects.requireNonNull(id, "La aprobacion requiere un identificador");
        Objects.requireNonNull(actionProposalId, "La aprobacion requiere una accion");
        Objects.requireNonNull(state, "La aprobacion requiere un estado");
        if (actionRevision < 1 || version < 1) {
            throw DomainError.validation("La aprobacion requiere revision y version positivas");
        }
        reason = reason == null ? "" : reason.trim();
    }

    public static Approval pending(ResourceId actionProposalId, int revision) {
        return new Approval(ResourceId.newId(), actionProposalId, revision, State.PENDING, null, null, "", 1);
    }

    public Approval decide(ApprovalDecision decision) {
        Objects.requireNonNull(decision, "La decision es obligatoria");
        if (state != State.PENDING || actionRevision != decision.actionRevision()) {
            throw DomainError.approvalStale("La aprobacion ya no corresponde a la revision vigente");
        }
        State next = decision.decision() == ApprovalDecision.Decision.APPROVE ? State.APPROVED : State.DENIED;
        return new Approval(id, actionProposalId, actionRevision, next, decision.decidedBy(), Instant.now(),
                decision.reason(), version + 1);
    }

    public Approval invalidateFor(ActionProposal proposal) {
        Objects.requireNonNull(proposal, "La accion revisada es obligatoria");
        if (!actionProposalId.equals(proposal.id()) || state != State.PENDING
                || actionRevision == proposal.revision()) {
            return this;
        }
        return new Approval(id, actionProposalId, actionRevision, State.INVALIDATED, null, Instant.now(),
                "La accion fue revisada", version + 1);
    }

    public boolean executable() {
        return state == State.APPROVED;
    }
}
