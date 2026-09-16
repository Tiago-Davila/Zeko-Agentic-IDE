import { useState } from 'react';

import { panelId, tabId } from '../design/tabIds';
import type { TabItem } from '../design/Tabs';
import { ProjectPicker } from '../features/projects/ProjectPicker';
import { RepositoryList } from '../features/projects/RepositoryList';
import { AgentsCanvas } from '../features/agents/AgentsCanvas';
import { ConversationPanel } from '../features/conversations/ConversationPanel';
import { MemoryPanel } from '../features/memory/MemoryPanel';
import { RuntimeCanvas } from '../features/runtime/RuntimeCanvas';
import type { ProjectDto, RepositoryDto } from '../features/projects/projectApi';
import { AppHeader } from './shell/AppHeader';
import { AppSidebar } from './shell/AppSidebar';
import { StatusBar } from './shell/StatusBar';
import { WorkspaceContextReader } from './WorkspaceContext';

type WorkspaceSurface = 'agents' | 'runtime';

const surfaces: readonly TabItem<WorkspaceSurface>[] = [
  { value: 'agents', label: 'Agents Canvas' },
  { value: 'runtime', label: 'Runtime Canvas' },
];

const descriptions: Record<WorkspaceSurface, string> = {
  agents: 'Diseñá agentes, plantillas y skills dentro del proyecto local.',
  runtime: 'Observá ejecuciones, approvals, efectos y resultados confirmados.',
};

export function WorkspaceShell() {
  const [activeSurface, setActiveSurface] = useState<WorkspaceSurface>('agents');
  const [activeProject, setActiveProject] = useState<ProjectDto | null>(null);

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
    <WorkspaceContextReader>
      {(workspace) => (
        <div className="flex h-full flex-col bg-ink-950">
          <AppHeader
            surfaces={surfaces}
            surface={activeSurface}
            onSurfaceChange={setActiveSurface}
            project={workspace.project}
            repository={workspace.repository}
            connection={workspace.connection}
          />

          <div className="flex min-h-0 flex-1">
            <AppSidebar />
            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
              <section
                id={panelId('surface', activeSurface)}
                role="tabpanel"
                aria-labelledby={tabId('surface', activeSurface)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="shrink-0 border-b border-ink-700 bg-ink-900/60 px-4 py-2">
                  <h2 className="text-sm font-semibold text-chalk-50">
                    {surfaces.find((item) => item.value === activeSurface)?.label}
                  </h2>
                  <p className="text-xs text-chalk-400">{descriptions[activeSurface]}</p>
                </div>

                {activeSurface === 'agents' ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex shrink-0 flex-wrap items-start gap-6 border-b border-ink-700 bg-ink-900/40 px-4 py-2">
                      <ProjectPicker
                        onProjectSelected={(project) => selectProject(project, workspace.selectProject)}
                        onConnectionChange={workspace.setConnection}
                      />
                      <RepositoryList
                        project={activeProject}
                        onRepositoryAdded={addRepository}
                        onRepositorySelected={(repository) =>
                          workspace.selectRepository(repository.id, repository.path)
                        }
                      />
                    </div>

                    <AgentsCanvas projectId={workspace.projectId} />

                    <div className="flex h-[248px] shrink-0 divide-x divide-ink-700 border-t border-ink-700 bg-ink-900">
                      <div className="min-w-0 flex-1 overflow-auto p-3">
                        <ConversationPanel projectId={workspace.projectId} />
                      </div>
                      <div className="min-w-0 flex-1 overflow-auto p-3">
                        <MemoryPanel projectId={workspace.projectId} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto p-4">
                    <RuntimeCanvas projectId={workspace.projectId} />
                  </div>
                )}
              </section>
            </main>
          </div>

          <StatusBar />
        </div>
      )}
    </WorkspaceContextReader>
  );
}
