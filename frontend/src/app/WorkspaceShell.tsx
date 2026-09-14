import { useState } from 'react';

import { StatusPanel } from '../components/StatusPanel';

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
  const active = surfaces[activeSurface];

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
      </section>
      <StatusPanel />
    </main>
  );
}
