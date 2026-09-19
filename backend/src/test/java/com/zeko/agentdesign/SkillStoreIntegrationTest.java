package com.zeko.agentdesign;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.agentdesign.application.SkillRepository;
import com.zeko.agentdesign.domain.SkillDefinition;
import com.zeko.agentdesign.infrastructure.SkillFileStore;
import com.zeko.projectcatalog.application.ProjectRepository;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class SkillStoreIntegrationTest {
    @TempDir
    static Path localDataDir;
    @Autowired private SkillRepository skills;
    @Autowired private ProjectRepository projects;
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("skills.db").toString());
    }
    @Test void keepsLocalSkillMetadataAndDoesNotOverwriteExistingFiles() throws Exception {
        ResourceId projectId = ResourceId.newId();
        Path root = localDataDir.resolve("project");
        projects.save(Project.create(projectId, "Zeko", root));
        SkillFileStore files = new SkillFileStore();
        Path relative = Path.of("skills", "review", "SKILL.md");
        files.create(root, relative, "# Review");
        SkillDefinition skill = new SkillDefinition(ResourceId.newId(), projectId, "Review", relative,
                files.fingerprint(root, relative), SkillDefinition.Scope.PROJECT);
        skills.save(skill);
        assertThat(skills.findById(skill.id())).contains(skill);
        assertThatThrownBy(() -> files.create(root, relative, "# Changed")).isInstanceOf(DomainError.class);
        assertThat(Files.readString(root.resolve(relative))).isEqualTo("# Review");
        assertThatThrownBy(() -> files.resolveProjectSkill(root, Path.of("..", "SKILL.md")))
                .isInstanceOf(DomainError.class);
    }
}
