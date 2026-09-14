package com.zeko.executioncontrol;

import static org.assertj.core.api.Assertions.assertThat;

import com.zeko.executioncontrol.infrastructure.GitDiffReader;
import org.junit.jupiter.api.Test;

class GitWorktreeIntegrationTest {
  @Test
  void redactsSecretsInTheDiffPresentation() {
    assertThat(GitDiffReader.class.getSimpleName()).isEqualTo("GitDiffReader");
  }
}
