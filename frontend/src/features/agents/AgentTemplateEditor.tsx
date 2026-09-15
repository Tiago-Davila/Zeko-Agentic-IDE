import { useState } from 'react';
import { createTemplate, type AgentTemplateDto } from './agentApi';
interface AgentTemplateEditorProps {
  readonly projectId: string;
  readonly onCreated: (item: AgentTemplateDto) => void;
}

export function AgentTemplateEditor({ projectId, onCreated }: AgentTemplateEditorProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('local');
  const [error, setError] = useState('');
  return <form onSubmit={(event) => { event.preventDefault(); setError(''); void createTemplate(projectId, name, { role, prompt, model }).then(onCreated).catch(() => setError('No se pudo guardar la plantilla local.')); }}>
    <label>Nombre de plantilla<input aria-label="Nombre de plantilla" value={name} onChange={(event) => setName(event.target.value)} required /></label>
    <label>Rol<input aria-label="Rol del agente" value={role} onChange={(event) => setRole(event.target.value)} required /></label>
    <label>Prompt base<textarea aria-label="Prompt base" value={prompt} onChange={(event) => setPrompt(event.target.value)} required /></label>
    <label>Modelo<select aria-label="Modelo local" value={model} onChange={(event) => setModel(event.target.value)}><option value="local">Ollama local</option></select></label>
    <button type="submit">Crear plantilla</button>
    {error ? <p role="alert">{error}</p> : null}
  </form>;
}
