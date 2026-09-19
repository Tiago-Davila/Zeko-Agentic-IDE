package com.zeko.memorysearch.application;

import com.zeko.agentdesign.application.AgentService;
import com.zeko.coordination.application.ConversationService;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.memorysearch.domain.MemoryScope;
import com.zeko.projectcatalog.application.ProjectService;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.charset.StandardCharsets;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.stereotype.Service;

@Service
public class MemorySourceService {
  private final MemoryRepository entries;
  private final ContextIndex index;
  private final SourceReader reader;
  private final ProjectService projects;
  private final AgentService agents;
  private final ConversationService conversations;

  public MemorySourceService(MemoryRepository entries, ContextIndex index,
                             SourceReader reader, ProjectService projects,
                             AgentService agents,
                             ConversationService conversations) {
    this.entries = entries;
    this.index = index;
    this.reader = reader;
    this.projects = projects;
    this.agents = agents;
    this.conversations = conversations;
  }

  public MemoryEntry register(ResourceId projectId, String rawPath,
                              String rawScope, String rawOwnerId) {
    Project project = projects.find(projectId);
    MemoryScope scope = scope(rawScope);
    ResourceId ownerId = owner(projectId, scope, rawOwnerId);
    Path source = path(rawPath);
    String content = reader.read(project.rootPath(), source);
    MemoryEntry entry = new MemoryEntry(
        ResourceId.newId(), scope, project.id(), ownerId,
        source.toAbsolutePath().normalize().toString(), fingerprint(content),
        MemoryEntry.IndexState.CURRENT, false);
    try {
      index.index(entry, content);
      entries.save(entry);
      return entry;
    } catch (DomainError unavailable) {
      if (unavailable.code() == DomainError.Code.PROVIDER_UNAVAILABLE) {
        entries.save(entry.withState(MemoryEntry.IndexState.UNAVAILABLE));
      }
      throw unavailable;
    }
  }

  private ResourceId owner(ResourceId projectId, MemoryScope scope,
                           String rawOwnerId) {
    if (scope == MemoryScope.GLOBAL) {
      throw DomainError.forbidden(
          "La memoria global requiere una promocion explicita");
    }
    ResourceId ownerId = rawOwnerId == null || rawOwnerId.isBlank()
        ? projectId : ResourceId.parse(rawOwnerId);
    if (scope == MemoryScope.PROJECT) {
      if (!projectId.equals(ownerId)) {
        throw DomainError.validation(
            "La memoria de proyecto debe pertenecer al proyecto activo");
      }
      return ownerId;
    }
    if (scope == MemoryScope.AGENT) {
      if (!agents.instance(ownerId).projectId().equals(projectId)) {
        throw DomainError.validation("El agente no pertenece al proyecto activo");
      }
      return ownerId;
    }
    if (!conversations.find(ownerId).projectId().equals(projectId)) {
      throw DomainError.validation(
          "La conversacion no pertenece al proyecto activo");
    }
    return ownerId;
  }

  private static MemoryScope scope(String value) {
    if (value == null || value.isBlank()) {
      throw DomainError.validation("El alcance de memoria es obligatorio");
    }
    try {
      return MemoryScope.valueOf(value.trim());
    } catch (IllegalArgumentException invalid) {
      throw DomainError.validation("El alcance de memoria no es valido");
    }
  }

  private static Path path(String rawPath) {
    if (rawPath == null || rawPath.isBlank()) {
      throw DomainError.pathInvalid("La ruta de fuente local es obligatoria");
    }
    try {
      return Path.of(rawPath);
    } catch (InvalidPathException malformed) {
      throw DomainError.pathInvalid("La ruta de fuente local no es valida");
    }
  }

  private static String fingerprint(String content) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256")
          .digest(content.getBytes(StandardCharsets.UTF_8));
      return java.util.HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException unavailable) {
      throw new IllegalStateException("SHA-256 no esta disponible", unavailable);
    }
  }
}
