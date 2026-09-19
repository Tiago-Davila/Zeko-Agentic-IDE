import { useState, type FormEvent } from 'react';

import { Button } from '../../design/Button';
import { Field } from '../../design/Field';
import { Select } from '../../design/Select';
import { inputStyles } from '../../design/inputStyles';
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    void createTemplate(projectId, name, { role, prompt, model })
      .then(onCreated)
      .catch(() => setError('No se pudo guardar la plantilla.'));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field
        label="Nombre de plantilla"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Revisor de specs"
        required
      />
      <Field
        label="Rol del agente"
        value={role}
        onChange={(event) => setRole(event.target.value)}
        placeholder="Revisa specs contra la constitución"
        required
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-chalk-400">Prompt base</span>
        <textarea
          aria-label="Prompt base"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          required
          className={`${inputStyles} h-auto resize-y py-2 font-mono text-xs leading-relaxed`}
        />
      </label>
      <Select label="Modelo" value={model} onChange={(event) => setModel(event.target.value)}>
        <option value="local">Ollama</option>
      </Select>
      <Button type="submit" variant="primary">
        Crear plantilla
      </Button>
      {error ? (
        <p role="alert" className="text-[11px] text-state-failed">
          {error}
        </p>
      ) : null}
    </form>
  );
}
