import { useState } from 'react';

import { ProjectLauncher } from '../features/launcher/ProjectLauncher';
import type { ProjectDto } from '../features/projects/projectApi';
import { WorkspaceContextProvider, WorkspaceContextReader } from './WorkspaceContext';
import { WorkspaceShell } from './WorkspaceShell';

export function App() {
  return (
    <WorkspaceContextProvider>
      <AppScreens />
    </WorkspaceContextProvider>
  );
}

/*
 * Dos pantallas y una transicion: el launcher elige proyecto y el workspace trabaja
 * sobre el. No se agrega router porque es una app local de una sola ventana.
 */
function AppScreens() {
  const [screen, setScreen] = useState<'launcher' | 'workspace'>('launcher');
  const [openedProject, setOpenedProject] = useState<ProjectDto | null>(null);

  return (
    <WorkspaceContextReader>
      {(workspace) =>
        screen === 'launcher' ? (
          <ProjectLauncher
            onOpenProject={(project) => {
              setOpenedProject(project);
              workspace.selectProject(project.id, project.name);
              setScreen('workspace');
            }}
            onOpenWorkspace={() => setScreen('workspace')}
            onConnectionChange={workspace.setConnection}
          />
        ) : (
          <WorkspaceShell initialProject={openedProject} onBackToLauncher={() => setScreen('launcher')} />
        )
      }
    </WorkspaceContextReader>
  );
}
