package com.zeko.memorysearch.application;

import com.zeko.sharedkernel.domain.DomainError;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

public final class SourceAdmissionPolicy {
  private static final Set<String> EXTENSIONS = Set.of("md", "txt", "java", "ts", "tsx", "json");

  public void validate(Path root, Path source) {
    Path normalizedRoot = root.toAbsolutePath().normalize();
    Path normalized = source.toAbsolutePath().normalize();
    if (!normalized.startsWith(normalizedRoot)
        || containsSymbolicLink(normalizedRoot, normalized)) {
      throw DomainError.forbidden("La fuente local no esta admitida");
    }
    Path physical = physicalSource(normalizedRoot, normalized);
    String name = physical.getFileName().toString();
    if (name.startsWith(".env")) {
      throw DomainError.forbidden("La fuente local no esta admitida");
    }
    int dot = name.lastIndexOf('.');
    if (dot < 1 || !EXTENSIONS.contains(name.substring(dot + 1).toLowerCase(java.util.Locale.ROOT))) {
      throw DomainError.forbidden("El formato de fuente no esta admitido");
    }
  }

  private static Path physicalSource(Path root, Path source) {
    try {
      Path physicalRoot = root.toRealPath();
      Path physicalSource = source.toRealPath();
      if (!Files.isRegularFile(physicalSource) || !physicalSource.startsWith(physicalRoot)) {
        throw DomainError.forbidden("La fuente local no esta admitida");
      }
      return physicalSource;
    } catch (java.nio.file.NoSuchFileException missing) {
      throw DomainError.forbidden("La fuente local no esta admitida");
    } catch (IOException unavailable) {
      throw DomainError.providerUnavailable("La fuente local no esta disponible");
    }
  }

  private static boolean containsSymbolicLink(Path root, Path source) {
    Path cursor = root;
    Path relative = root.relativize(source);
    for (Path segment : relative) {
      cursor = cursor.resolve(segment);
      if (Files.isSymbolicLink(cursor)) {
        return true;
      }
    }
    return false;
  }
}
