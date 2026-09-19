import { createContext, useCallback, useMemo, useState, type PropsWithChildren, type ReactNode } from 'react';

export type LocalConnectionState = 'connecting' | 'ready' | 'error';

export interface WorkspaceState {
  readonly projectId: string | null;
  readonly repositoryId: string | null;
  readonly project: string;
  readonly repository: string;
  readonly task: string;
  readonly agent: string;
  readonly connection: LocalConnectionState;
}

export interface WorkspaceContextValue extends WorkspaceState {
  selectProject(projectId: string, projectName: string): void;
  selectRepository(repositoryId: string, repositoryPath: string): void;
  setConnection(connection: LocalConnectionState): void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const initialWorkspace: WorkspaceState = {
  projectId: null,
  repositoryId: null,
  project: 'Sin proyecto',
  repository: 'Sin repositorio',
  task: 'Sin tarea',
  agent: 'Sin agente',
  connection: 'connecting',
};

export function WorkspaceContextProvider({ children }: PropsWithChildren) {
  const [workspace, setWorkspace] = useState<WorkspaceState>(initialWorkspace);
  const selectProject = useCallback((projectId: string, projectName: string) => {
    setWorkspace((current) => ({
      ...current,
      projectId,
      project: projectName,
      repositoryId: null,
      repository: 'Sin repositorio',
    }));
  }, []);
  const selectRepository = useCallback((repositoryId: string, repositoryPath: string) => {
    setWorkspace((current) => ({ ...current, repositoryId, repository: repositoryPath }));
  }, []);
  const setConnection = useCallback((connection: LocalConnectionState) => {
    setWorkspace((current) => ({ ...current, connection }));
  }, []);
  const value = useMemo(
    () => ({ ...workspace, selectProject, selectRepository, setConnection }),
    [workspace, selectProject, selectRepository, setConnection],
  );

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

interface WorkspaceContextReaderProps {
  readonly children: (workspace: WorkspaceContextValue) => ReactNode;
}

export function WorkspaceContextReader({ children }: WorkspaceContextReaderProps) {
  return (
    <WorkspaceContext.Consumer>
      {(workspace) => {
        if (workspace === undefined) {
          throw new Error('El contexto del workspace es obligatorio');
        }

        return children(workspace);
      }}
    </WorkspaceContext.Consumer>
  );
}
