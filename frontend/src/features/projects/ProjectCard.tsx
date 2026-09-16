import { Badge } from '../../design/Badge';
import { StatePill } from '../../design/StatePill';
import type { ProjectDto } from './projectApi';

interface ProjectCardProps {
  readonly project: ProjectDto;
  readonly onOpen: () => void;
}

export function ProjectCard({ project, onOpen }: ProjectCardProps) {
  const repositories = project.repositories;
  const initials = project.name.slice(0, 2).toUpperCase();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-start gap-3 rounded-[var(--radius-panel)] border border-ink-700 bg-ink-900 p-3 text-left transition-colors duration-150 hover:border-spray-lime/50 hover:bg-ink-850"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-ink-600 bg-ink-800 text-xs font-bold text-spray-lime"
      >
        {initials}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-chalk-50">{project.name}</span>
        <span className="truncate font-mono text-[11px] text-chalk-400" title={project.rootPath}>
          {project.rootPath}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-1">
          <Badge tone="muted">
            {repositories.length} {repositories.length === 1 ? 'repositorio' : 'repositorios'}
          </Badge>
          {repositories.slice(0, 2).map((repository) => (
            <StatePill key={repository.id} state={repository.accessState} dense />
          ))}
        </span>
      </span>
    </button>
  );
}
