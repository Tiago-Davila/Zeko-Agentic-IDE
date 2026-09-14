import { useEffect, useState, type FormEvent } from 'react';

import { HttpClientError } from '../../app/api/errors';
import { createProject, listProjects, type ProjectDto } from './projectApi';

interface ProjectPickerProps {
  readonly onProjectSelected: (project: ProjectDto) => void;
  readonly onConnectionChange: (state: 'ready' | 'error') => void;
}

export function ProjectPicker({ onProjectSelected, onConnectionChange }: ProjectPickerProps) {
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const project = await createProject({ name, rootPath });
      setProjects((current) => [...current, project]);
      onProjectSelected(project);
      setName('');
      setRootPath('');
      setError(null);
    } catch (failure) {
      setError(messageOf(failure));
    }
  }

  return (
    <section aria-labelledby="projects-heading">
      <h3 id="projects-heading">Proyectos locales</h3>
      <label>
        Abrir proyecto
        <select defaultValue="" onChange={(event) => selectProject(event.target.value, projects, onProjectSelected)}>
          <option value="" disabled>
            Elegí un proyecto
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={submit}>
        <label>
          Nombre del proyecto
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Raíz local
          <input value={rootPath} onChange={(event) => setRootPath(event.target.value)} required />
        </label>
        <button type="submit">Crear proyecto</button>
      </form>
      {error === null ? null : <p role="alert">{error}</p>}
    </section>
  );
}

function selectProject(projectId: string, projects: readonly ProjectDto[], onProjectSelected: (project: ProjectDto) => void) {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (project !== undefined) {
    onProjectSelected(project);
  }
}

function messageOf(failure: unknown): string {
  return failure instanceof HttpClientError ? failure.message : 'No se pudo cargar el proyecto local';
}
