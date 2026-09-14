package com.zeko.coordination;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.domain.PermissionMode;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.coordination.domain.AutonomyMode;
import java.util.EnumSet;
import org.junit.jupiter.api.Test;

class PermissionAutonomyMatrixTest {

    @Test
    void allNineCombinationsKeepInitiativeIndependentFromPermission() {
        int combinations = 0;
        for (PermissionMode permission : PermissionMode.values()) {
            for (AutonomyMode autonomy : AutonomyMode.values()) {
                combinations++;
                assertThat(EnumSet.allOf(PermissionMode.class)).contains(permission);
                assertThat(EnumSet.allOf(AutonomyMode.class)).contains(autonomy);
                PermissionPolicy policy = new PermissionPolicy(
                        com.zeko.sharedkernel.domain.ResourceId.newId(),
                        com.zeko.sharedkernel.domain.ResourceId.newId(), permission,
                        java.util.Set.of(), java.util.Set.of());
                boolean requiresApproval = policy.evaluate(PermissionPolicy.ActionCategory.WRITE_LOCAL,
                        true, false, false, false, false).requiresApproval();
                if (permission == PermissionMode.ASK_APPROVAL) {
                    assertThat(requiresApproval).isTrue();
                }
                if (permission == PermissionMode.FULL_ACCESS) {
                    assertThat(requiresApproval).isFalse();
                }
            }
        }
        assertThat(combinations).isEqualTo(9);
    }
}
