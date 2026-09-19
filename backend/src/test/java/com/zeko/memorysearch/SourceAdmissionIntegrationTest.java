package com.zeko.memorysearch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.memorysearch.infrastructure.LocalSourceReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SourceAdmissionIntegrationTest {

  @TempDir
  Path root;

  @TempDir
  Path outside;

  private final LocalSourceReader reader = new LocalSourceReader();

  @Test
  void rejectsSymbolicLinksEvenWhenTheirNamesAreInsideTheAllowedRoot()
      throws IOException {
    Path external = outside.resolve("external.txt");
    Files.writeString(external, "outside");
    Path link = root.resolve("link.txt");
    Files.createSymbolicLink(link, external);

    assertThatThrownBy(() -> reader.read(root, link))
        .hasMessageContaining("no esta admitida");
  }

  @Test
  void rejectsSensitiveValuesAcrossMultipleLines() throws IOException {
    Path source = root.resolve("notes.txt");
    Files.writeString(source, "encabezado\nsecret\n= SYNTHETIC_AUDIT_VALUE\npie");

    assertThatThrownBy(() -> reader.read(root, source))
        .hasMessageContaining("contenido sensible");
  }

  @Test
  void readsARegularAdmittedSourceWithoutSensitiveValues() throws IOException {
    Path source = root.resolve("notes.txt");
    Files.writeString(source, "contexto local admitido");

    assertThat(reader.read(root, source)).isEqualTo("contexto local admitido");
  }
}
