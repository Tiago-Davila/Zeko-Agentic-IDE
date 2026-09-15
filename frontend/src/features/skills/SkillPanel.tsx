import { useEffect, useState } from 'react';

import { bindSkill, registerSkill, skills, type SkillBindingDto, type SkillDto } from './skillApi';

interface SkillPanelProps {
  readonly projectId: string | null;
  readonly instanceId?: string | null;
  readonly boundSkillIds?: ReadonlySet<string>;
  readonly onBound?: (binding: SkillBindingDto) => void;
}

export function SkillPanel({ projectId, instanceId = null, boundSkillIds = new Set(), onBound = () => {} }: SkillPanelProps) {
  const [items, setItems] = useState<readonly SkillDto[]>([]);
  const [name, setName] = useState('');
  const [path, setPath] = useState('SKILL.md');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (projectId !== null) void skills(projectId).then(setItems).catch(() => setItems([]));
  }, [projectId]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (projectId === null || !name.trim() || !path.trim()) return;
    setError('');
    setMessage('');
    try {
      const skill = await registerSkill(projectId, name.trim(), path.trim());
      setItems((current) => [...current, skill]);
      setName('');
      setMessage('Skill de proyecto guardada.');
    } catch {
      setError('No se pudo guardar la skill local. Usá una ruta válida a SKILL.md.');
    }
  }

  async function associate(skill: SkillDto) {
    if (instanceId === null || boundSkillIds.has(skill.id)) return;
    try {
      onBound(await bindSkill(instanceId, skill.id));
      setMessage(`Skill ${skill.name} asociada a la instancia.`);
      setError('');
    } catch {
      setError('No se pudo asociar la skill a esta instancia.');
    }
  }

  return <section aria-label="Skills de proyecto">
    <h3>Skills locales</h3>
    <p>Una skill describe contexto; no concede permisos ni herramientas.</p>
    {projectId === null ? <p>Seleccioná un proyecto para gestionar skills.</p> : <>
      <form onSubmit={(event) => void create(event)}>
        <label>Nombre de skill<input aria-label="Nombre de skill" value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label>Ruta SKILL.md<input aria-label="Ruta SKILL.md" value={path} onChange={(event) => setPath(event.target.value)} required /></label>
        <button type="submit">Guardar skill</button>
      </form>
      <ul>{items.map((item) => <li key={item.id}><span>{item.name} · {item.scope}</span>{instanceId === null ? null : boundSkillIds.has(item.id) ? <strong> Asociada</strong> : <button type="button" onClick={() => void associate(item)}>Asociar a instancia</button>}</li>)}</ul>
    </>}
    {message ? <p role="status">{message}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
