package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.executioncontrol.domain.CommitMessagePolicy;
import org.junit.jupiter.api.Test;

class AuthorizedCommitIntegrationTest {
  @Test
  void rejectsCommitsWithoutTaskIdOrAssistantTrailers() {
    CommitMessagePolicy policy = new CommitMessagePolicy();
    assertThatThrownBy(() -> policy.validate("feat: missing task"))
        .isInstanceOf(RuntimeException.class);
    assertThatThrownBy(() -> policy.validate("feat: T063 add dispatch Co-authored-by"))
        .isInstanceOf(RuntimeException.class);
  }
}
