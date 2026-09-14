import { WorkspaceContextProvider } from './WorkspaceContext';
import { WorkspaceShell } from './WorkspaceShell';

export function App() {
  return (
    <WorkspaceContextProvider>
      <WorkspaceShell />
    </WorkspaceContextProvider>
  );
}
