import { useState } from 'react';

import { Button } from '../../design/Button';
import { cn } from '../../design/cn';
import { inputStyles } from '../../design/inputStyles';
import { ZekoWordmark } from '../../app/brand/ZekoWordmark';
import { ProjectPicker } from '../projects/ProjectPicker';
import type { ProjectDto } from '../projects/projectApi';

interface ProjectLauncherProps {
  readonly onOpenProject: (project: ProjectDto) => void;
  readonly onOpenWorkspace: () => void;
  readonly onConnectionChange: (state: 'ready' | 'error') => void;
}

/*
 * Secciones del rail. Solo "Proyectos" tiene respaldo en el backend; el resto queda
 * visible y deshabilitado con el motivo a la vista, para no aparentar capacidades
 * que el MVP no expone.
 */
const sections = [
  { id: 'projects', label: 'Proyectos', enabled: true, reason: '' },
  { id: 'repositories', label: 'Repositorios', enabled: false, reason: 'Se gestionan dentro de un proyecto abierto.' },
  { id: 'providers', label: 'Proveedores', enabled: false, reason: 'El backend todavía no expone estado de Docker ni Ollama.' },
  { id: 'learn', label: 'Aprender', enabled: false, reason: 'Sin contenido local disponible.' },
] as const;

export function ProjectLauncher({ onOpenProject, onOpenWorkspace, onConnectionChange }: ProjectLauncherProps) {
  const [query, setQuery] = useState('');

  return (
    <div className="flex h-full bg-ink-950">
      <aside className="flex w-60 shrink-0 flex-col gap-4 border-r border-ink-700 bg-ink-900 p-4">
        <div className="flex items-center">
          <h1 className="flex items-center">
            <span className="sr-only">Zeko Agentic IDE</span>
            <ZekoWordmark className="h-9" />
          </h1>
        </div>

        <nav aria-label="Secciones del launcher" className="flex flex-col gap-0.5">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              disabled={!section.enabled}
              aria-current={section.enabled ? 'page' : undefined}
              title={section.enabled ? undefined : section.reason}
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

        <p className="mt-auto text-[11px] leading-relaxed text-chalk-600">
          Workspace local. Un proyecto puede contener varios repositorios.
        </p>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-700 px-6">
          <input
            type="search"
            aria-label="Buscar proyectos"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar proyectos por nombre o ruta"
            className={cn(inputStyles, 'max-w-md')}
          />
          <Button variant="ghost" className="ml-auto" onClick={onOpenWorkspace}>
            Abrir workspace sin proyecto
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-6">
          <ProjectPicker
            variant="launcher"
            query={query}
            onProjectSelected={onOpenProject}
            onConnectionChange={onConnectionChange}
          />
        </div>
      </main>
    </div>
  );
}
