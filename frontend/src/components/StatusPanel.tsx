import { WorkspaceContextReader } from '../app/WorkspaceContext';

const connectionLabels = {
  connecting: 'Conectando al backend local',
  ready: 'Backend local disponible',
  error: 'Backend local no disponible',
} as const;

export function StatusPanel() {
  return (
    <WorkspaceContextReader>
      {(workspace) => (
        <aside aria-label="Estado del workspace">
          <h2>Estado local</h2>
          <dl>
            <dt>Proyecto</dt>
            <dd>{workspace.project}</dd>
            <dt>Repositorio</dt>
            <dd>{workspace.repository}</dd>
            <dt>Tarea</dt>
            <dd>{workspace.task}</dd>
            <dt>Agente</dt>
            <dd>{workspace.agent}</dd>
            <dt>Conexión</dt>
            <dd aria-live="polite">{connectionLabels[workspace.connection]}</dd>
          </dl>
        </aside>
      )}
    </WorkspaceContextReader>
  );
}
