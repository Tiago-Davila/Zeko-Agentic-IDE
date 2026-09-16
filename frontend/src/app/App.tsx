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
 * Dos pantallas y una transicion. Al workspace solo se entra con un proyecto que ya tenga
 * al menos un repositorio con ruta local: sin eso no hay nada sobre lo que operar.
 */
function AppScreens() {
  const [openedProject, setOpenedProject] = useState<ProjectDto | null>(null);

  return (
    <WorkspaceContextReader>
      {(workspace) =>
        openedProject === null ? (
          <ProjectLauncher
            onOpenProject={(project) => {
              const first = project.repositories[0];
              if (first === undefined) return;
              setOpenedProject(project);
              workspace.selectProject(project.id, project.name);
              workspace.selectRepository(first.id, first.path);
            }}
            onConnectionChange={workspace.setConnection}
          />
        ) : (
          <WorkspaceShell initialProject={openedProject} onBackToLauncher={() => setOpenedProject(null)} />
        )
      }
    </WorkspaceContextReader>
  );
}
