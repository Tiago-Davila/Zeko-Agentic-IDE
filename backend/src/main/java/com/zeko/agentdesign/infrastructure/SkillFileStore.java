package com.zeko.agentdesign.infrastructure;

import com.zeko.sharedkernel.domain.DomainError;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class SkillFileStore {
    public Path resolveProjectSkill(Path projectRoot, Path skillPath) {
        Path root = projectRoot.toAbsolutePath().normalize();
        Path resolved = (skillPath.isAbsolute() ? skillPath : root.resolve(skillPath)).normalize();
        if (!resolved.startsWith(root) || !"SKILL.md".equals(resolved.getFileName().toString())) {
            throw DomainError.pathInvalid("La skill debe estar dentro del proyecto y llamarse SKILL.md");
        }
        return resolved;
    }

    public String fingerprint(Path projectRoot, Path skillPath) {
        Path file = resolveProjectSkill(projectRoot, skillPath);
        try {
            return hex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file)));
        } catch (IOException error) {
            throw DomainError.pathInvalid("No se pudo leer el archivo SKILL.md local");
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 no esta disponible", unavailable);
        }
    }

    public void create(Path projectRoot, Path skillPath, String content) {
        Path target = resolveProjectSkill(projectRoot, skillPath);
        if (content == null || content.isBlank()) {
            throw DomainError.validation("El contenido de SKILL.md es obligatorio");
        }
        try {
            Files.createDirectories(target.getParent());
            if (Files.exists(target)) {
                throw DomainError.conflict("El archivo SKILL.md ya existe");
            }
            Path temporary = Files.createTempFile(target.getParent(), ".skill-", ".tmp");
            try {
                Files.writeString(temporary, content, StandardCharsets.UTF_8);
                Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE);
            } finally {
                Files.deleteIfExists(temporary);
            }
        } catch (java.nio.file.FileAlreadyExistsException exists) {
            throw DomainError.conflict("El archivo SKILL.md ya existe");
        } catch (IOException error) {
            throw DomainError.pathInvalid("No se pudo crear el archivo SKILL.md local");
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder value = new StringBuilder();
        for (byte item : bytes) {
            value.append(String.format("%02x", item));
        }
        return value.toString();
    }
}
