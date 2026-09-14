package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.executioncontrol.domain.ActionProposal;
import com.zeko.executioncontrol.domain.PermissionPolicy;
import com.zeko.executioncontrol.infrastructure.LocalFilesystemAdapter;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FilesystemAdapterIntegrationTest {
  @TempDir Path worktree;
  @Test
  void writesWithinTheWorktreeAndRejectsEscapes() {
    LocalFilesystemAdapter adapter = new LocalFilesystemAdapter();
    ActionProposal write = action("WRITE_LOCAL", "note.txt", List.of("safe"));
    assertThat(adapter.execute(write).knownState()).isEqualTo("WRITTEN");
    assertThatThrownBy(
        () -> adapter.execute(action("WRITE_LOCAL", "../outside", List.of("bad"))))
        .isInstanceOf(RuntimeException.class);
  }
  private ActionProposal action(String type, String resource, List<String> arguments) {
    return new ActionProposal(ResourceId.newId(), ResourceId.newId(), null,
                              ResourceId.newId(), type, resource, "local",
                              worktree.toString(), arguments, "", Set.of("file"),
                              PermissionPolicy.ActionCategory.WRITE_LOCAL, 1);
  }
}
