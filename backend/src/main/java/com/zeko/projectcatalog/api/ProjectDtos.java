package com.zeko.projectcatalog.api;

import com.zeko.projectcatalog.domain.Project;
import com.zeko.projectcatalog.domain.Repository;
import java.util.List;

public final class ProjectDtos {

    private ProjectDtos() {
    }

    public record CreateProjectRequest(String name, String rootPath) {
    }

    public record AddRepositoryRequest(String path) {
    }

    public record ProjectResponse(String id, String name, String rootPath, List<RepositoryResponse> repositories) {
    }

    public record RepositoryResponse(String id, String projectId, String path, String accessState) {
    }

    public static ProjectResponse project(Project project) {
        return new ProjectResponse(
                project.id().asString(), project.name(), project.rootPath().toString(),
                project.repositories().stream().map(ProjectDtos::repository).toList());
    }

    public static RepositoryResponse repository(Repository repository) {
        return new RepositoryResponse(
                repository.id().asString(), repository.projectId().asString(), repository.normalizedPath().toString(),
                repository.accessState().name());
    }
}
