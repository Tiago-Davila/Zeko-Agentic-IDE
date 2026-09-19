package com.zeko.projectcatalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.projectcatalog.application.ProjectRepository;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.projectcatalog.domain.Repository;
import com.zeko.projectcatalog.domain.RepositoryAccessState;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest
class ProjectRepositoryIntegrationTest {

    @TempDir
    static Path localDataDir;

    @Autowired
    private ProjectRepository repository;

    @DynamicPropertySource
    static void localDatabase(DynamicPropertyRegistry registry) {
        registry.add("zeko.datasource.path", () -> localDataDir.resolve("projects.db").toString());
    }

    @Test
    void reopensAProjectWithItsRepositoriesAndOwnership() {
        ResourceId projectId = ResourceId.newId();
        Project project = Project.create(projectId, "Zeko", Path.of("workspace/zeko"))
                .attach(repository(projectId, "workspace/zeko/backend"))
                .attach(repository(projectId, "workspace/zeko/frontend"));

        repository.save(project);

        assertThat(repository.findById(projectId)).contains(project);
        assertThat(repository.findAll()).contains(project);
    }

    @Test
    void rejectsARepositoryPathAlreadyOwnedByTheSameProject() {
        ResourceId projectId = ResourceId.newId();
        Project first = Project.create(projectId, "Zeko", Path.of("workspace/zeko"))
                .attach(repository(projectId, "workspace/zeko/backend"));
        repository.save(first);
        Project duplicate = new Project(projectId, "Zeko", Path.of("workspace/zeko"), java.util.List.of(
                repository(projectId, "workspace/zeko/backend")));

        assertThatThrownBy(() -> repository.save(duplicate)).isInstanceOf(DataAccessException.class);
        assertThat(repository.findById(projectId)).contains(first);
    }

    private static Repository repository(ResourceId projectId, String path) {
        Path value = Path.of(path);
        return new Repository(ResourceId.newId(), projectId, value, value, RepositoryAccessState.AVAILABLE, null);
    }
}
