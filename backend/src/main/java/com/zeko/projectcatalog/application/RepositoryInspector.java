package com.zeko.projectcatalog.application;

import com.zeko.projectcatalog.domain.RepositoryAccessState;
import java.nio.file.Path;

public interface RepositoryInspector {

    Inspection inspect(Path candidate);

    record Inspection(Path normalizedPath, Path gitRoot, RepositoryAccessState accessState, String fingerprint) {
    }
}
