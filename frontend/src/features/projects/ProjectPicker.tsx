import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Button } from '../../design/Button';
import { EmptyState } from '../../design/EmptyState';
import { Field } from '../../design/Field';
import { inputStyles } from '../../design/inputStyles';
import { HttpClientError } from '../../app/api/errors';
import { ProjectCard } from './ProjectCard';
import { createProject, listProjects, type ProjectDto } from './projectApi';

interface ProjectPickerProps {
  readonly onProjectSelected: (project: ProjectDto) => void;
  readonly onConnectionChange: (state: 'ready' | 'error') => void;
  // 'launcher' muestra la galeria de tarjetas; 'compact' solo el selector y el alta.
  readonly variant?: 'launcher' | 'compact' | undefined;
  readonly query?: string | undefined;
}

export function ProjectPicker({
  onProjectSelected,
  onConnectionChange,
  variant = 'compact',
  query = '',
}: ProjectPickerProps) {
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const available = await listProjects();
        setProjects(available);
        onConnectionChange('ready');
      } catch (failure) {
        onConnectionChange('error');
        setError(messageOf(failure));
      }
    }

    void loadProjects();
  }, [onConnectionChange]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(needle) || project.rootPath.toLowerCase().includes(needle),
    );
  }, [projects, query]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const project = await createProject({ name, rootPath });
      setProjects((current) => [...current, project]);
      onProjectSelected(project);
      setName('');
      setRootPath('');
      setCreating(false);
      setError(null);
    } catch (failure) {
      setError(messageOf(failure));
    }
  }

  const options = (
    <>
      <option value="" disabled>
        Elegí un proyecto
      </option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </>
  );

  function onSelect(event: { target: { value: string } }) {
    selectProject(event.target.value, projects, onProjectSelected);
  }

  // En el launcher el selector va en una barra de herramientas y se nombra por aria-label;
  // en la franja del workspace conserva su etiqueta visible.
  const selector =
    variant === 'launcher' ? (
      <select
        aria-label="Abrir proyecto"
        defaultValue=""
        className={`${inputStyles} w-52 cursor-pointer`}
        onChange={onSelect}
      >
        {options}
      </select>
    ) : (
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-chalk-400">Abrir proyecto</span>
        <select defaultValue="" className={`${inputStyles} cursor-pointer`} onChange={onSelect}>
          {options}
        </select>
      </label>
    );

  const form = (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <Field
        label="Nombre del proyecto"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Zeko Agentic IDE"
        required
      />
      <Field
        label="Raíz local"
        mono
        value={rootPath}
        onChange={(event) => setRootPath(event.target.value)}
        placeholder="/home/usuario/proyecto"
        required
      />
      <Button type="submit" variant="primary">
        Crear proyecto
      </Button>
    </form>
  );

  if (variant === 'compact') {
    return (
      <section aria-labelledby="projects-heading" className="flex flex-wrap items-end gap-3">
        <h3 id="projects-heading" className="sr-only">
          Proyectos locales
        </h3>
        <div className="w-56">{selector}</div>
        <details className="text-xs text-chalk-400">
          <summary className="cursor-pointer select-none py-2 hover:text-chalk-200">Nuevo proyecto</summary>
          <div className="mt-2 w-64 rounded-[var(--radius-panel)] border border-ink-700 bg-ink-900 p-3">{form}</div>
        </details>
        {error === null ? null : (
          <p role="alert" className="text-xs text-state-failed">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="projects-heading" className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <h3 id="projects-heading" className="text-lg font-semibold text-chalk-50">
          Proyectos locales
        </h3>
        <div className="ml-auto flex items-center gap-2">
          {selector}
          <Button variant="primary" onClick={() => setCreating((open) => !open)} aria-expanded={creating}>
            Nuevo proyecto
          </Button>
        </div>
      </div>

      {creating ? (
        <div className="max-w-md rounded-[var(--radius-panel)] border border-ink-700 bg-ink-900 p-4">{form}</div>
      ) : null}

      {error === null ? null : (
        <p role="alert" className="text-xs text-state-failed">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={
            projects.length === 0
              ? 'Todavía no hay proyectos locales.'
              : 'Ningún proyecto coincide con la búsqueda.'
          }
          description={
            projects.length === 0
              ? 'Creá uno apuntando a una carpeta de tu máquina. Un proyecto puede contener varios repositorios.'
              : undefined
          }
          action={
            projects.length === 0 && !creating ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                Crear el primero
              </Button>
            ) : undefined
          }
          className="flex-1"
        />
      ) : (
        <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 overflow-y-auto pr-1">
          {visible.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} onOpen={() => onProjectSelected(project)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function selectProject(
  projectId: string,
  projects: readonly ProjectDto[],
  onProjectSelected: (project: ProjectDto) => void,
) {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (project !== undefined) {
    onProjectSelected(project);
  }
}

function messageOf(failure: unknown): string {
  return failure instanceof HttpClientError ? failure.message : 'No se pudo cargar el proyecto local';
}
