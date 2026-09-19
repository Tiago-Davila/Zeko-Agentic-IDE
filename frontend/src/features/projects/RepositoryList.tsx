import { useState, type FormEvent } from 'react';

import { Button } from '../../design/Button';
import { StatePill } from '../../design/StatePill';
import { inputStyles } from '../../design/inputStyles';
import { HttpClientError } from '../../app/api/errors';
import { addRepository, type ProjectDto, type RepositoryDto } from './projectApi';

interface RepositoryListProps {
  readonly project: ProjectDto | null;
  // Presente solo donde se configuran repositorios; hoy, el launcher.
  readonly onRepositoryAdded?: ((repository: RepositoryDto) => void) | undefined;
  readonly onRepositorySelected?: ((repository: RepositoryDto) => void) | undefined;
  readonly activeRepositoryId?: string | null | undefined;
}

export function RepositoryList({
  project,
  onRepositoryAdded,
  onRepositorySelected,
  activeRepositoryId = null,
}: RepositoryListProps) {
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (project === null) {
    return null;
  }
  const selectedProject = project;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const repository = await addRepository(selectedProject.id, path);
      onRepositoryAdded?.(repository);
      onRepositorySelected?.(repository);
      setPath('');
      setError(null);
    } catch (failure) {
      setError(messageOf(failure));
    }
  }

  return (
    <section aria-label="Repositorios" className="flex min-w-0 flex-col gap-2">
      {selectedProject.repositories.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-1.5">
          {selectedProject.repositories.map((repository) => (
            <li key={repository.id}>
              {/* El nombre accesible es solo la ruta: el estado va aparte para no contaminarlo. */}
              <button
                type="button"
                aria-label={repository.path}
                aria-pressed={activeRepositoryId === repository.id}
                onClick={() => onRepositorySelected?.(repository)}
                className={`flex items-center gap-1.5 rounded-[var(--radius-control)] border px-2 py-1 font-mono text-[11px] transition-colors ${
                  activeRepositoryId === repository.id
                    ? 'border-spray-lime/50 bg-spray-lime/10 text-chalk-50'
                    : 'border-ink-700 bg-ink-850 text-chalk-200 hover:border-ink-600 hover:text-chalk-50'
                }`}
              >
                {repository.path}
                <StatePill state={repository.accessState} dense aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {onRepositoryAdded === undefined ? null : (
        <form onSubmit={submit} className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="sr-only">Ruta del repositorio</span>
            <input
              aria-label="Ruta del repositorio"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              required
              placeholder="/ruta/al/repositorio"
              className={`${inputStyles} font-mono text-xs`}
            />
          </label>
          <Button type="submit">Asociar repositorio</Button>
        </form>
      )}

      {error === null ? null : (
        <p role="alert" className="text-[11px] text-state-failed">
          {error}
        </p>
      )}
    </section>
  );
}

function messageOf(failure: unknown): string {
  return failure instanceof HttpClientError ? failure.message : 'No se pudo asociar el repositorio';
}
