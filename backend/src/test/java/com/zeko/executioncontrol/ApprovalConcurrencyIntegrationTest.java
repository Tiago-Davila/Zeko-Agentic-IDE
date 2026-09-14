package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.executioncontrol.application.ApprovalRepository;
import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.Approval;
import com.zeko.executioncontrol.domain.ApprovalDecision;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class ApprovalConcurrencyIntegrationTest {

    @TempDir
    static Path localDataDir;

    @Autowired
    private ApprovalRepository approvals;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("approvals.db").toString());
    }

    @Test
    void invalidatingARevisionRejectsAStaleApproval() {
        ActionProposal original = action(1);
        approvals.saveAction(original);
        Approval pending = Approval.pending(original.id(), 1);
        approvals.saveApproval(pending);
        approvals.saveAction(original.revise("WRITE_LOCAL", "other.txt", "worktree", ".", List.of(), "",
                Set.of("write"), com.zeko.executioncontrol.domain.PermissionPolicy.ActionCategory.WRITE_LOCAL));

        assertThat(approvals.findApproval(pending.id())).get().extracting(Approval::state)
                .isEqualTo(Approval.State.INVALIDATED);
        assertThatThrownBy(() -> approvals.decide(pending.id(),
                new ApprovalDecision(ApprovalDecision.Decision.APPROVE, 1, ResourceId.newId(), "tarde")))
                .isInstanceOf(DomainError.class)
                .extracting(error -> ((DomainError) error).code())
                .isEqualTo(DomainError.Code.APPROVAL_STALE);
    }

    @Test
    void onlyOneConcurrentDecisionWins() throws InterruptedException {
        ActionProposal action = action(1);
        approvals.saveAction(action);
        Approval pending = Approval.pending(action.id(), 1);
        approvals.saveApproval(pending);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(2);
        AtomicInteger accepted = new AtomicInteger();
        for (int i = 0; i < 2; i++) {
            Thread thread = new Thread(() -> {
                await(start);
                try {
                    approvals.decide(pending.id(), new ApprovalDecision(
                            ApprovalDecision.Decision.APPROVE, 1, ResourceId.newId(), "ok"));
                    accepted.incrementAndGet();
                } catch (DomainError ignored) {
                    // La segunda confirmacion pierde la condicion de version.
                } finally {
                    done.countDown();
                }
            });
            thread.start();
        }
        start.countDown();
        assertThat(done.await(10, TimeUnit.SECONDS)).isTrue();
        assertThat(accepted).hasValue(1);
    }

    private static ActionProposal action(int revision) {
        return new ActionProposal(ResourceId.newId(), ResourceId.newId(), "READ_LOCAL", "README.md", "worktree",
                Set.of("read"), revision);
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }
}
