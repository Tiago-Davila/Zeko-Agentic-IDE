package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.executioncontrol.application.ActionClassifier;
import com.zeko.executioncontrol.infrastructure.HostActionNormalizer;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ActionClassifierTest {

    @Test
    void classifiesCompositeEffectsConservatively() {
        ActionClassifier classifier = new ActionClassifier();
        ActionClassifier.ClassifiedAction action = classifier.classify(new ActionClassifier.Request(
                null, ResourceId.newId(), null, null, "WRITE_LOCAL", "src/App.java", "worktree", ".",
                List.of("src/App.java"), "", Set.of("write", "delete backup"), 1));
        assertThat(action.proposal().classification()).isEqualTo(PermissionPolicy.ActionCategory.DESTRUCTIVE);
        assertThat(action.destructive()).isTrue();
    }

    @Test
    void rejectsArbitraryShellAndPathsOutsideTheWorktree() {
        ActionClassifier classifier = new ActionClassifier();
        assertThatThrownBy(() -> classifier.classify(new ActionClassifier.Request(
                null, ResourceId.newId(), null, null, "SHELL", "x", "worktree", ".", List.of(), "", Set.of(), 1)))
                .isInstanceOf(DomainError.class);

        HostActionNormalizer normalizer = new HostActionNormalizer();
        assertThatThrownBy(() -> normalizer.normalizePath(Path.of("/tmp/worktree"), "../secrets"))
                .isInstanceOf(DomainError.class)
                .extracting(error -> ((DomainError) error).code())
                .isEqualTo(DomainError.Code.PATH_INVALID);
    }
}
