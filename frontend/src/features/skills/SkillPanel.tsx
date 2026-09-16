import { useEffect, useState, type FormEvent } from 'react';

import { Badge } from '../../design/Badge';
import { Button } from '../../design/Button';
import { Field } from '../../design/Field';
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

  async function create(event: FormEvent<HTMLFormElement>) {
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

  return (
    <section aria-label="Skills de proyecto" className="flex min-h-0 flex-col gap-3">
      <header className="shrink-0">
        <h3 className="text-xs font-semibold tracking-wide text-chalk-400 uppercase">Skills locales</h3>
        <p className="text-[11px] text-chalk-600">
          Una skill describe contexto; no concede permisos ni herramientas.
        </p>
      </header>

      {projectId === null ? (
        <p className="text-xs text-chalk-400">Seleccioná un proyecto para gestionar skills.</p>
      ) : (
        <>
          <form
            onSubmit={(event) => void create(event)}
            className="flex shrink-0 flex-wrap items-end gap-2 rounded-[var(--radius-panel)] border border-ink-700 bg-ink-850 p-2"
          >
            <Field
              label="Nombre de skill"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="java-springboot"
              required
              fieldClassName="min-w-40 flex-1"
            />
            <Field
              label="Ruta SKILL.md"
              mono
              value={path}
              onChange={(event) => setPath(event.target.value)}
              required
              fieldClassName="min-w-56 flex-1"
            />
            <Button type="submit">Guardar skill</Button>
          </form>

          {items.length === 0 ? (
            <p className="text-xs text-chalk-400">Todavía no hay skills registradas en este proyecto.</p>
          ) : (
            <ul className="grid min-h-0 auto-rows-min grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2 overflow-y-auto pr-1">
              {items.map((item) => {
                const bound = boundSkillIds.has(item.id);
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1.5 rounded-[var(--radius-panel)] border border-ink-700 bg-ink-850 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 truncate text-xs font-medium text-chalk-50">{item.name}</span>
                      <Badge tone="muted" className="ml-auto">
                        {item.scope}
                      </Badge>
                    </div>
                    <span className="truncate font-mono text-[10px] text-chalk-600" title={item.skillPath}>
                      {item.skillPath}
                    </span>
                    {instanceId === null ? null : bound ? (
                      <Badge tone="info" className="self-start">
                        Asociada
                      </Badge>
                    ) : (
                      <Button size="sm" className="self-start" onClick={() => void associate(item)}>
                        Asociar a instancia
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {message ? (
        <p role="status" className="shrink-0 text-[11px] text-state-completed">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="shrink-0 text-[11px] text-state-failed">
          {error}
        </p>
      ) : null}
    </section>
  );
}
