package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.domain.PermissionMode;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PermissionPolicyTest {

    @Test
    void evaluatesConservativeModesInTheRequiredOrder() {
        PermissionPolicy ask = policy(PermissionMode.ASK_APPROVAL, Set.of());
        assertThat(ask.evaluate(PermissionPolicy.ActionCategory.PROHIBITED, true, false, false,
                false, false).denied()).isTrue();
        assertThat(ask.evaluate(PermissionPolicy.ActionCategory.WRITE_LOCAL, true, false, false,
                false, false).requiresApproval()).isTrue();

        PermissionPolicy auto = policy(PermissionMode.AUTO_APPROVE, Set.of("READ_LOCAL"));
        assertThat(auto.evaluate(PermissionPolicy.ActionCategory.READ_LOCAL, true, false, false).allowed()).isTrue();
        assertThat(auto.evaluate(PermissionPolicy.ActionCategory.WRITE_LOCAL, true, false, false).requiresApproval())
                .isTrue();

        PermissionPolicy full = policy(PermissionMode.FULL_ACCESS, Set.of("READ_LOCAL"));
        assertThat(full.evaluate(PermissionPolicy.ActionCategory.WRITE_LOCAL, true, true, false,
                false, false).allowed()).isTrue();
        assertThat(full.evaluate(PermissionPolicy.ActionCategory.WRITE_LOCAL, true, true, false,
                true, false).denied()).isTrue();
        assertThat(full.evaluate(PermissionPolicy.ActionCategory.READ_LOCAL, true, false, false,
                false, true).denied()).isTrue();
    }

    private static PermissionPolicy policy(PermissionMode mode, Set<String> rules) {
        return new PermissionPolicy(ResourceId.newId(), ResourceId.newId(), mode, rules, Set.of());
    }
}
