import { useState } from 'react';

import { StatusPanel } from '../components/StatusPanel';
import { ProjectPicker } from '../features/projects/ProjectPicker';
import { RepositoryList } from '../features/projects/RepositoryList';
import { AgentsCanvas } from '../features/agents/AgentsCanvas';
import { SkillPanel } from '../features/skills/SkillPanel';
import type { ProjectDto, RepositoryDto } from '../features/projects/projectApi';
import { WorkspaceContextReader } from './WorkspaceContext';

type WorkspaceSurface = 'agents' | 'runtime';

const surfaces: Record<WorkspaceSurface, { readonly label: string; readonly title: string; readonly description: string }> = {
  agents: {
    label: 'Agents Canvas',
    title: 'Agents Canvas',
    description: 'Diseñá agentes, plantillas y skills dentro del proyecto local.',
  },
  runtime: {
    label: 'Runtime Canvas',
    title: 'Runtime Canvas',
    description: 'Observá ejecuciones, approvals, efectos y resultados confirmados.',
  },
};

export function WorkspaceShell() {
  const [activeSurface, setActiveSurface] = useState<WorkspaceSurface>('agents');
  const [activeProject, setActiveProject] = useState<ProjectDto | null>(null);
  const active = surfaces[activeSurface];

  function selectProject(project: ProjectDto, select: (id: string, name: string) => void) {
    setActiveProject(project);
    select(project.id, project.name);
  }

  function addRepository(repository: RepositoryDto) {
    setActiveProject((project) => {
      if (project === null || project.id !== repository.projectId) {
        return project;
      }
      return { ...project, repositories: [...project.repositories, repository] };
    });
  }

  return (
    <main>
      <header>
        <h1>Zeko Agentic IDE</h1>
        <p>Workspace local-first para diseño y observación de agentes.</p>
      </header>
      <div role="tablist" aria-label="Superficies del workspace">
        {(Object.keys(surfaces) as WorkspaceSurface[]).map((surface) => (
          <button
            key={surface}
            id={`${surface}-tab`}
            type="button"
            role="tab"
            aria-selected={activeSurface === surface}
            aria-controls={`${surface}-panel`}
            onClick={() => setActiveSurface(surface)}
          >
            {surfaces[surface].label}
          </button>
        ))}
      </div>
      <section id={`${activeSurface}-panel`} role="tabpanel" aria-labelledby={`${activeSurface}-tab`}>
        <h2>{active.title}</h2>
        <p>{active.description}</p>
        {activeSurface === 'agents' ? (
          <WorkspaceContextReader>
            {(workspace) => (
              <>
                <ProjectPicker
                  onProjectSelected={(project) => selectProject(project, workspace.selectProject)}
                  onConnectionChange={workspace.setConnection}
                />
                <RepositoryList
                  project={activeProject}
                  onRepositoryAdded={addRepository}
                  onRepositorySelected={(repository) => workspace.selectRepository(repository.id, repository.path)}
                />
                <AgentsCanvas projectId={workspace.projectId} />
                <SkillPanel projectId={workspace.projectId} />
              </>
            )}
          </WorkspaceContextReader>
        ) : null}
      </section>
      <StatusPanel />
    </main>
  );
}
