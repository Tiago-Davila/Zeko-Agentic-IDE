import { useState } from 'react';

import { Button } from '../../design/Button';
import { cn } from '../../design/cn';
import { inputStyles } from '../../design/inputStyles';
import { ZekoWordmark } from '../../app/brand/ZekoWordmark';
import { ProjectPicker } from '../projects/ProjectPicker';
import { RepositoryList } from '../projects/RepositoryList';
import type { ProjectDto, RepositoryDto } from '../projects/projectApi';

interface ProjectLauncherProps {
  readonly onOpenProject: (project: ProjectDto) => void;
  readonly onConnectionChange: (state: 'ready' | 'error') => void;
}

const sections = [
  { id: 'projects', label: 'Proyectos', enabled: true },
  { id: 'repositories', label: 'Repositorios', enabled: false },
  { id: 'providers', label: 'Proveedores', enabled: false },
  { id: 'learn', label: 'Aprender', enabled: false },
] as const;

export function ProjectLauncher({ onOpenProject, onConnectionChange }: ProjectLauncherProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ProjectDto | null>(null);

  /*
   * Un proyecto sin repositorios no puede abrir ninguna superficie, asi que al elegirlo
   * se queda en esta pantalla para configurarlos. Con al menos uno, entra directo.
   */
  function select(project: ProjectDto) {
    setSelected(project);
    if (project.repositories.length > 0) {
      onOpenProject(project);
    }
  }

  function addRepository(repository: RepositoryDto) {
    setSelected((project) => {
      if (project === null || project.id !== repository.projectId) return project;
      return { ...project, repositories: [...project.repositories, repository] };
    });
  }

  return (
    <div className="flex h-full bg-ink-950">
      <aside className="flex w-56 shrink-0 flex-col gap-4 border-r border-ink-700 bg-ink-900 p-4">
        <h1 className="flex items-center">
          <span className="sr-only">Zeko Agentic IDE</span>
          <ZekoWordmark className="h-9" />
        </h1>

        <nav aria-label="Secciones del launcher" className="flex flex-col gap-0.5">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              disabled={!section.enabled}
              aria-current={section.enabled ? 'page' : undefined}
              className={cn(
                'rounded-[var(--radius-control)] px-3 py-2 text-left text-sm transition-colors duration-150',
                section.enabled
                  ? 'bg-spray-lime/12 font-medium text-spray-lime'
                  : 'cursor-not-allowed text-chalk-600',
              )}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-ink-700 px-6">
          <input
            type="search"
            aria-label="Buscar proyectos"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar proyectos"
            className={cn(inputStyles, 'max-w-md')}
          />
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
            <ProjectPicker
              query={query}
              selectedProjectId={selected?.id ?? null}
              onProjectSelected={select}
              onConnectionChange={onConnectionChange}
            />
          </div>

          {selected === null ? null : (
            <aside
              aria-label="Configuración del proyecto"
              className="flex w-[380px] shrink-0 flex-col gap-4 border-l border-ink-700 bg-ink-900 p-4"
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-chalk-50">{selected.name}</h3>
                <p className="truncate font-mono text-[11px] text-chalk-600" title={selected.rootPath}>
                  {selected.rootPath}
                </p>
              </div>

              <RepositoryList project={selected} onRepositoryAdded={addRepository} />

              <Button
                variant="primary"
                className="mt-auto"
                disabled={selected.repositories.length === 0}
                onClick={() => onOpenProject(selected)}
              >
                Abrir proyecto
              </Button>
              {selected.repositories.length === 0 ? (
                <p className="text-[11px] text-state-waiting">
                  Asociá al menos un repositorio para abrir el proyecto.
                </p>
              ) : null}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
