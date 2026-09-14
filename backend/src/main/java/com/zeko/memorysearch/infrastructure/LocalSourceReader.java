package com.zeko.memorysearch.infrastructure;

import com.zeko.memorysearch.application.SourceAdmissionPolicy;
import com.zeko.sharedkernel.domain.DomainError;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.stereotype.Component;

@Component
public class LocalSourceReader {
  private static final int MAX_BYTES = 256 * 1024;
  private final SourceAdmissionPolicy admission = new SourceAdmissionPolicy();

  public String read(Path root, Path source) {
    admission.validate(root, source);
    try {
      if (Files.size(source) > MAX_BYTES) {
        throw DomainError.forbidden("La fuente local supera el limite permitido");
      }
      String content = Files.readString(source);
      if (content.toLowerCase(java.util.Locale.ROOT).matches(".*(token|password|secret|authorization).*")) {
        throw DomainError.forbidden("La fuente contiene contenido sensible");
      }
      return content;
    } catch (IOException error) {
      throw DomainError.providerUnavailable("La fuente local no esta disponible");
    }
  }
}
