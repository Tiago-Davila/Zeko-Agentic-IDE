package com.zeko.agentdesign.application;

import java.nio.file.Path;

public interface SkillContentStore {
    String fingerprint(Path projectRoot, Path skillPath);
}
