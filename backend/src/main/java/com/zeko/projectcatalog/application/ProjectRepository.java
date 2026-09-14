package com.zeko.projectcatalog.application;

import com.zeko.projectcatalog.domain.Project;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.List;
import java.util.Optional;

public interface ProjectRepository {

    void save(Project project);

    Optional<Project> findById(ResourceId projectId);

    List<Project> findAll();
}
