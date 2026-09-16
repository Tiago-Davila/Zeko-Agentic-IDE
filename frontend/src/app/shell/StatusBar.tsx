import type { ReactNode } from 'react';

import { WorkspaceContextReader } from '../WorkspaceContext';

const connectionLabels = {
  connecting: 'Conectando al backend local',
  ready: 'Backend local disponible',
  error: 'Backend local no disponible',
} as const;

const connectionDots = {
  connecting: 'bg-state-waiting animate-pulse',
  ready: 'bg-state-completed',
  error: 'bg-state-failed',
} as const;

/*
 * Barra inferior de estado. Sustituye visualmente al StatusPanel apilado, pero conserva
 * su nombre accesible y las cinco entradas del <dl>, que son contrato de las pruebas.
 */
export function StatusBar() {
  return (
    <WorkspaceContextReader>
      {(workspace) => (
        <aside
          aria-label="Estado del workspace"
          className="flex h-7 shrink-0 items-center gap-4 border-t border-ink-700 bg-ink-900 px-3 text-[11px]"
        >
          <h2 className="sr-only">Estado local</h2>
          <dl className="flex min-w-0 flex-1 items-center gap-4">
            <Entry term="Proyecto">{workspace.project}</Entry>
            <Entry term="Repositorio" mono>
              {workspace.repository}
            </Entry>
            <Entry term="Tarea">{workspace.task}</Entry>
            <Entry term="Agente">{workspace.agent}</Entry>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <dt className="sr-only">Conexión</dt>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${connectionDots[workspace.connection]}`} />
              <dd aria-live="polite" className="text-chalk-400">
                {connectionLabels[workspace.connection]}
              </dd>
            </div>
          </dl>
        </aside>
      )}
    </WorkspaceContextReader>
  );
}

interface EntryProps {
  readonly term: string;
  readonly mono?: boolean | undefined;
  readonly children: ReactNode;
}

function Entry({ term, mono = false, children }: EntryProps) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <dt className="shrink-0 text-chalk-600">{term}</dt>
      <dd className={`truncate text-chalk-200 ${mono ? 'font-mono' : ''}`}>{children}</dd>
    </div>
  );
}
