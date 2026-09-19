import { useState } from 'react';

import { EmptyState } from '../design/EmptyState';
import { SplitPane } from '../design/SplitPane';
import { panelId, tabId } from '../design/tabIds';
import type { TabItem } from '../design/Tabs';
import { RepositoryList } from '../features/projects/RepositoryList';
import { AgentsCanvas } from '../features/agents/AgentsCanvas';
import { ArchitectureCanvas } from '../features/architecture/ArchitectureCanvas';
import { ConversationPanel } from '../features/conversations/ConversationPanel';
import { MemoryPanel } from '../features/memory/MemoryPanel';
import { RuntimeCanvas } from '../features/runtime/RuntimeCanvas';
import { TerminalPanel } from '../features/terminal/TerminalPanel';
import type { ProjectDto } from '../features/projects/projectApi';
import { AppHeader } from './shell/AppHeader';
import { AppSidebar } from './shell/AppSidebar';
import { BottomDock } from './shell/BottomDock';
import type { DockTab } from './shell/dockTabs';
import { StatusBar } from './shell/StatusBar';
import { WorkspaceContextReader } from './WorkspaceContext';

type WorkspaceSurface = 'agents' | 'runtime' | 'architecture';

const surfaces: readonly TabItem<WorkspaceSurface>[] = [
  { value: 'agents', label: 'Agents Canvas' },
  { value: 'runtime', label: 'Runtime Canvas' },
  { value: 'architecture', label: 'Arquitectura' },
];

interface WorkspaceShellProps {
  readonly initialProject?: ProjectDto | null | undefined;
  readonly onBackToLauncher?: (() => void) | undefined;
}

export function WorkspaceShell({ initialProject = null, onBackToLauncher }: WorkspaceShellProps = {}) {
  const [activeSurface, setActiveSurface] = useState<WorkspaceSurface>('agents');
  const activeProject = initialProject;
  const [dockTab, setDockTab] = useState<DockTab>('chat');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [dockHeight, setDockHeight] = useState(260);

  return (
    <WorkspaceContextReader>
      {(workspace) => {
        const surface = (
          <section
            id={panelId('surface', activeSurface)}
            role="tabpanel"
            aria-labelledby={tabId('surface', activeSurface)}
            className="flex h-full min-h-0 flex-col"
          >
            {activeSurface === 'agents' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center border-b border-ink-700 bg-ink-900/40 px-4 py-1.5">
                  <RepositoryList
                    project={activeProject}
                    activeRepositoryId={workspace.repositoryId}
                    onRepositorySelected={(repository) =>
                      workspace.selectRepository(repository.id, repository.path)
                    }
                  />
                </div>
                <AgentsCanvas projectId={workspace.projectId} />
              </div>
            ) : activeSurface === 'runtime' ? (
              <RuntimeCanvas projectId={workspace.projectId} />
            ) : (
              <ArchitectureCanvas project={activeProject} />
            )}
          </section>
        );

        const dock = (
          <BottomDock
            tab={dockTab}
            onTabChange={setDockTab}
            collapsed={dockCollapsed}
            onToggleCollapsed={() => setDockCollapsed((collapsed) => !collapsed)}
          >
            {dockTab === 'terminal' ? <TerminalPanel /> : null}
            {dockTab === 'chat' ? (
              <div className="p-3">
                <ConversationPanel projectId={workspace.projectId} />
              </div>
            ) : null}
            {dockTab === 'library' ? (
              <div className="flex h-full min-h-0 divide-x divide-ink-700">
                <div className="min-w-0 flex-1 overflow-auto p-3">
                  <MemoryPanel projectId={workspace.projectId} />
                </div>
              </div>
            ) : null}
            {dockTab === 'traces' ? (
              <EmptyState title="Sin recurso seleccionado." />
            ) : null}
          </BottomDock>
        );

        return (
          <div className="flex h-full flex-col bg-ink-950">
            <AppHeader
              surfaces={surfaces}
              surface={activeSurface}
              onSurfaceChange={setActiveSurface}
              project={workspace.project}
              repository={workspace.repository}
              connection={workspace.connection}
              {...(onBackToLauncher === undefined ? {} : { onBackToLauncher })}
            />

            <div className="flex min-h-0 flex-1">
              <AppSidebar
                activeTab={dockTab}
                dockCollapsed={dockCollapsed}
                onSelectTab={(tab) => {
                  // Elegir el panel que ya esta abierto lo pliega; si no, lo abre en esa pestana.
                  if (tab === dockTab && !dockCollapsed) {
                    setDockCollapsed(true);
                    return;
                  }
                  setDockTab(tab);
                  setDockCollapsed(false);
                }}
              />
              <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                {dockCollapsed ? (
                  <>
                    <div className="min-h-0 flex-1">{surface}</div>
                    {dock}
                  </>
                ) : (
                  <SplitPane
                    orientation="vertical"
                    size={dockHeight}
                    onSizeChange={setDockHeight}
                    min={140}
                    max={620}
                    label="Alto del panel inferior"
                    primary={surface}
                    secondary={dock}
                    className="flex-1"
                  />
                )}
              </main>
            </div>

            <StatusBar />
          </div>
        );
      }}
    </WorkspaceContextReader>
  );
}
