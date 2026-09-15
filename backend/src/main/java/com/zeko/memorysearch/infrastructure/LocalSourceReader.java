package com.zeko.memorysearch.infrastructure;

import com.zeko.memorysearch.application.SourceAdmissionPolicy;
import com.zeko.sharedkernel.domain.DomainError;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class LocalSourceReader {
  private static final int MAX_BYTES = 256 * 1024;
  private static final Pattern SENSITIVE_VALUE = Pattern.compile(
      "(?is)\\b(token|password|secret|authorization)\\b\\s*(=|:)");
  private final SourceAdmissionPolicy admission = new SourceAdmissionPolicy();

  public String read(Path root, Path source) {
    admission.validate(root, source);
    try {
      if (Files.size(source) > MAX_BYTES) {
        throw DomainError.forbidden("La fuente local supera el limite permitido");
      }
      String content = Files.readString(source);
      if (SENSITIVE_VALUE.matcher(content).find()) {
        throw DomainError.forbidden("La fuente contiene contenido sensible");
      }
      return content;
    } catch (IOException error) {
      throw DomainError.providerUnavailable("La fuente local no esta disponible");
    }
  }
}
