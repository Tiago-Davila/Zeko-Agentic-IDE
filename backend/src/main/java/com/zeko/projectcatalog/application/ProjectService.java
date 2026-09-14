package com.zeko.projectcatalog.application;

import com.zeko.projectcatalog.domain.Project;
import com.zeko.projectcatalog.domain.Repository;
import com.zeko.projectcatalog.domain.RepositoryAccessState;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class ProjectService {

    private final ProjectRepository projects;
    private final RepositoryInspector inspector;

    public ProjectService(ProjectRepository projects, RepositoryInspector inspector) {
        this.projects = Objects.requireNonNull(projects, "El repositorio de proyectos es obligatorio");
        this.inspector = Objects.requireNonNull(inspector, "El inspector de repositorios es obligatorio");
    }

    public Project create(String name, String rootPath) {
        Project project = Project.create(ResourceId.newId(), name, pathOf(rootPath));
        projects.save(project);
        return project;
    }

    public List<Project> list() {
        return projects.findAll();
    }

    public Project find(ResourceId projectId) {
        return projects.findById(projectId).orElseThrow(() -> DomainError.notFound("Project", projectId));
    }

    public Repository addRepository(ResourceId projectId, String path) {
        Project project = find(projectId);
        RepositoryInspector.Inspection inspection = inspector.inspect(pathOf(path));
        if (inspection.accessState() != RepositoryAccessState.AVAILABLE) {
            throw DomainError.pathInvalid("La ruta no corresponde a un repositorio local disponible");
        }

        Repository repository = new Repository(
                ResourceId.newId(), projectId, inspection.normalizedPath(), inspection.gitRoot(),
                inspection.accessState(), inspection.fingerprint());
        projects.save(project.attach(repository));
        return repository;
    }

    private static Path pathOf(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) {
            throw DomainError.validation("La ruta local es obligatoria");
        }
        try {
            return Path.of(rawPath);
        } catch (InvalidPathException malformed) {
            throw DomainError.pathInvalid("La ruta local no es valida");
        }
    }
}
