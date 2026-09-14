package com.zeko.memorysearch.application;

import com.zeko.sharedkernel.domain.DomainError;
import java.nio.file.Path;
import java.util.Set;

public final class SourceAdmissionPolicy {
  private static final Set<String> EXTENSIONS = Set.of("md", "txt", "java", "ts", "tsx", "json");

  public void validate(Path root, Path source) {
    Path normalizedRoot = root.toAbsolutePath().normalize();
    Path normalized = source.toAbsolutePath().normalize();
    if (!normalized.startsWith(normalizedRoot) || normalized.getFileName().toString().startsWith(".env")) {
      throw DomainError.forbidden("La fuente local no esta admitida");
    }
    String name = normalized.getFileName().toString();
    int dot = name.lastIndexOf('.');
    if (dot < 1 || !EXTENSIONS.contains(name.substring(dot + 1).toLowerCase(java.util.Locale.ROOT))) {
      throw DomainError.forbidden("El formato de fuente no esta admitido");
    }
  }
}
