package com.zeko.projectcatalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.zeko.projectcatalog.domain.Project;
import com.zeko.projectcatalog.domain.Repository;
import com.zeko.projectcatalog.domain.RepositoryAccessState;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProjectTest {

    @Test
    void associatesMultipleRepositoriesThatBelongToTheSameProject() {
        ResourceId projectId = ResourceId.newId();
        Project project = Project.create(projectId, "Zeko", Path.of("workspace/zeko"));
        Repository first = repository(projectId, "workspace/zeko/backend", RepositoryAccessState.AVAILABLE);
        Repository second = repository(projectId, "workspace/zeko/frontend", RepositoryAccessState.AVAILABLE);

        Project updated = project.attach(first).attach(second);

        assertThat(updated.repositories()).containsExactly(first, second);
        assertThat(updated.rootPath()).isEqualTo(Path.of("workspace/zeko").toAbsolutePath().normalize());
    }

    @Test
    void rejectsARepositoryOwnedByAnotherProject() {
        Project project = Project.create(ResourceId.newId(), "Zeko", Path.of("workspace/zeko"));
        Repository foreign = repository(ResourceId.newId(), "workspace/other", RepositoryAccessState.AVAILABLE);

        assertThatThrownBy(() -> project.attach(foreign))
                .isInstanceOf(DomainError.class)
                .extracting(error -> ((DomainError) error).code())
                .isEqualTo(DomainError.Code.VALIDATION);
    }

    @Test
    void rejectsTheSameNormalizedPathTwiceWithoutChangingExistingRepositories() {
        ResourceId projectId = ResourceId.newId();
        Project project = Project.create(projectId, "Zeko", Path.of("workspace/zeko"));
        Repository first = repository(projectId, "workspace/zeko/backend", RepositoryAccessState.AVAILABLE);
        Repository duplicate = repository(projectId, "workspace/zeko/./backend", RepositoryAccessState.AVAILABLE);
        Project withFirst = project.attach(first);

        assertThatThrownBy(() -> withFirst.attach(duplicate))
                .isInstanceOf(DomainError.class)
                .extracting(error -> ((DomainError) error).code())
                .isEqualTo(DomainError.Code.CONFLICT);
        assertThat(withFirst.repositories()).containsExactly(first);
    }

    @Test
    void rejectsDuplicatePathsWhenReconstructingAProject() {
        ResourceId projectId = ResourceId.newId();
        Repository first = repository(projectId, "workspace/zeko/backend", RepositoryAccessState.AVAILABLE);
        Repository duplicate = repository(projectId, "workspace/zeko/./backend", RepositoryAccessState.AVAILABLE);

        assertThatThrownBy(() -> new Project(projectId, "Zeko", Path.of("workspace/zeko"), List.of(first, duplicate)))
                .isInstanceOf(DomainError.class)
                .extracting(error -> ((DomainError) error).code())
                .isEqualTo(DomainError.Code.CONFLICT);
    }

    @Test
    void retainsInvalidAndUnavailableRepositoryMetadata() {
        ResourceId projectId = ResourceId.newId();
        Repository unavailable = repository(projectId, "workspace/zeko/offline", RepositoryAccessState.UNAVAILABLE);
        Repository invalid = repository(projectId, "workspace/zeko/not-git", RepositoryAccessState.INVALID);

        Project project = Project.create(projectId, "Zeko", Path.of("workspace/zeko"))
                .attach(unavailable)
                .attach(invalid);

        assertThat(project.repositories()).extracting(Repository::accessState)
                .containsExactly(RepositoryAccessState.UNAVAILABLE, RepositoryAccessState.INVALID);
        assertThat(project.repositories()).extracting(Repository::normalizedPath)
                .containsExactly(unavailable.normalizedPath(), invalid.normalizedPath());
    }

    private static Repository repository(ResourceId projectId, String path, RepositoryAccessState state) {
        Path normalized = Path.of(path);
        Path gitRoot = state == RepositoryAccessState.AVAILABLE ? normalized : null;
        return new Repository(ResourceId.newId(), projectId, normalized, gitRoot, state, null);
    }
}
