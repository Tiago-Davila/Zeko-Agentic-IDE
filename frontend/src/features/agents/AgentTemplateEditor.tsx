import { useState } from 'react';
import { createTemplate, type AgentTemplateDto } from './agentApi';
interface AgentTemplateEditorProps {
  readonly projectId: string;
  readonly onCreated: (item: AgentTemplateDto) => void;
}

export function AgentTemplateEditor({ projectId, onCreated }: AgentTemplateEditorProps) {
  const [name, setName] = useState('');
  return <form onSubmit={(event) => { event.preventDefault(); void createTemplate(projectId, name, {}).then(onCreated); }}><label>Nombre de plantilla<input aria-label="Nombre de plantilla" value={name} onChange={(event) => setName(event.target.value)} /></label><button type="submit">Crear plantilla</button></form>;
}
