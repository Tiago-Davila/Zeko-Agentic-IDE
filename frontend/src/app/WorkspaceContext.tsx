import { createContext, type PropsWithChildren, type ReactNode } from 'react';

export type LocalConnectionState = 'connecting' | 'ready' | 'error';

export interface WorkspaceState {
  readonly project: string;
  readonly repository: string;
  readonly task: string;
  readonly agent: string;
  readonly connection: LocalConnectionState;
}

const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined);

const initialWorkspace: WorkspaceState = {
  project: 'Sin proyecto local seleccionado',
  repository: 'Sin repositorio seleccionado',
  task: 'Sin tarea activa',
  agent: 'Sin agente activo',
  connection: 'connecting',
};

export function WorkspaceContextProvider({ children }: PropsWithChildren) {
  return <WorkspaceContext value={initialWorkspace}>{children}</WorkspaceContext>;
}

interface WorkspaceContextReaderProps {
  readonly children: (workspace: WorkspaceState) => ReactNode;
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
