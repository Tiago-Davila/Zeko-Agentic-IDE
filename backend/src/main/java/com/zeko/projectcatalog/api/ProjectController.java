package com.zeko.projectcatalog.api;

import com.zeko.projectcatalog.application.ProjectService;
import com.zeko.projectcatalog.api.ProjectDtos.AddRepositoryRequest;
import com.zeko.projectcatalog.api.ProjectDtos.CreateProjectRequest;
import com.zeko.projectcatalog.api.ProjectDtos.ProjectResponse;
import com.zeko.projectcatalog.api.ProjectDtos.RepositoryResponse;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projects;

    public ProjectController(ProjectService projects) {
        this.projects = projects;
    }

    @GetMapping
    public List<ProjectResponse> list() {
        return projects.list().stream().map(ProjectDtos::project).toList();
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> create(@RequestBody CreateProjectRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ProjectDtos.project(projects.create(request.name(), request.rootPath())));
    }

    @GetMapping("/{projectId}")
    public ProjectResponse find(@PathVariable String projectId) {
        return ProjectDtos.project(projects.find(ResourceId.parse(projectId)));
    }

    @PostMapping("/{projectId}/repositories")
    public ResponseEntity<RepositoryResponse> addRepository(
            @PathVariable String projectId,
            @RequestBody AddRepositoryRequest request) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ProjectDtos.repository(projects.addRepository(ResourceId.parse(projectId), request.path())));
    }
}
