package com.zeko.projectcatalog.infrastructure;

import com.zeko.projectcatalog.application.ProjectRepository;
import com.zeko.projectcatalog.domain.Project;
import com.zeko.projectcatalog.domain.Repository;
import com.zeko.projectcatalog.domain.RepositoryAccessState;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@org.springframework.stereotype.Repository
public class JdbcProjectRepository implements ProjectRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcProjectRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public void save(Project project) {
        jdbcTemplate.update(
                "INSERT INTO projects (id, name, root_path) VALUES (?, ?, ?) "
                        + "ON CONFLICT(id) DO UPDATE SET name = excluded.name, root_path = excluded.root_path, "
                        + "updated_at = CURRENT_TIMESTAMP, version = projects.version + 1",
                project.id().asString(), project.name(), project.rootPath().toString());
        project.repositories().forEach(repository -> saveRepository(repository));
    }

    @Override
    public Optional<Project> findById(ResourceId projectId) {
        List<Project> projects = jdbcTemplate.query(
                "SELECT id, name, root_path FROM projects WHERE id = ?",
                (row, index) -> project(row.getString("id"), row.getString("name"), row.getString("root_path")),
                projectId.asString());
        return projects.stream().findFirst().map(this::withRepositories);
    }

    @Override
    public List<Project> findAll() {
        return jdbcTemplate.query(
                        "SELECT id, name, root_path FROM projects ORDER BY created_at, id",
                        (row, index) -> project(row.getString("id"), row.getString("name"), row.getString("root_path")))
                .stream()
                .map(this::withRepositories)
                .toList();
    }

    private void saveRepository(Repository repository) {
        jdbcTemplate.update(
                "INSERT INTO repositories (id, project_id, normalized_path, git_root, access_state, fingerprint) "
                        + "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET "
                        + "normalized_path = excluded.normalized_path, git_root = excluded.git_root, "
                        + "access_state = excluded.access_state, fingerprint = excluded.fingerprint, "
                        + "updated_at = CURRENT_TIMESTAMP, version = repositories.version + 1",
                repository.id().asString(), repository.projectId().asString(), repository.normalizedPath().toString(),
                repository.gitRoot() == null ? null : repository.gitRoot().toString(), repository.accessState().name(),
                repository.fingerprint());
    }

    private Project withRepositories(Project project) {
        List<Repository> repositories = jdbcTemplate.query(
                "SELECT id, project_id, normalized_path, git_root, access_state, fingerprint FROM repositories "
                        + "WHERE project_id = ? ORDER BY normalized_path, id",
                (row, index) -> repository(
                        row.getString("id"), row.getString("project_id"), row.getString("normalized_path"),
                        row.getString("git_root"), row.getString("access_state"), row.getString("fingerprint")),
                project.id().asString());
        return new Project(project.id(), project.name(), project.rootPath(), repositories);
    }

    private static Project project(String id, String name, String rootPath) {
        return Project.create(ResourceId.parse(id), name, Path.of(rootPath));
    }

    private static Repository repository(
            String id,
            String projectId,
            String normalizedPath,
            String gitRoot,
            String accessState,
            String fingerprint) {

        return new Repository(
                ResourceId.parse(id), ResourceId.parse(projectId), Path.of(normalizedPath),
                gitRoot == null ? null : Path.of(gitRoot), RepositoryAccessState.valueOf(accessState), fingerprint);
    }
}
