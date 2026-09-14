import { useEffect, useState } from 'react';
import { type AgentTemplateDto, templates } from './agentApi';
import { AgentTemplateEditor } from './AgentTemplateEditor';

export function AgentsCanvas({ projectId }: { readonly projectId: string | null }) {
  const [items, setItems] = useState<readonly AgentTemplateDto[]>([]);
  useEffect(() => {
    if (projectId !== null) {
      void templates(projectId).then(setItems).catch(() => setItems([]));
    }
  }, [projectId]);
  if (projectId === null) return <p>Seleccioná un proyecto para diseñar agentes.</p>;
  return <section aria-label="Diseño de agentes"><h3>Plantillas de agente</h3><AgentTemplateEditor projectId={projectId} onCreated={(item) => setItems((current) => [...current, item])} /><ul>{items.map((item) => <li key={item.id}>{item.name} · versión {item.version} · Relación de configuración, no ejecución.</li>)}</ul></section>;
}
