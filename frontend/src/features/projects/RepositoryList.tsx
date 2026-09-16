import { useState, type FormEvent } from 'react';

import { Button } from '../../design/Button';
import { StatePill } from '../../design/StatePill';
import { inputStyles } from '../../design/inputStyles';
import { HttpClientError } from '../../app/api/errors';
import { addRepository, type ProjectDto, type RepositoryDto } from './projectApi';

interface RepositoryListProps {
  readonly project: ProjectDto | null;
  readonly onRepositoryAdded: (repository: RepositoryDto) => void;
  readonly onRepositorySelected: (repository: RepositoryDto) => void;
}

export function RepositoryList({ project, onRepositoryAdded, onRepositorySelected }: RepositoryListProps) {
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (project === null) {
    return <p className="self-center text-xs text-chalk-400">Elegí un proyecto para asociar repositorios.</p>;
  }
  const selectedProject = project;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const repository = await addRepository(selectedProject.id, path);
      onRepositoryAdded(repository);
      onRepositorySelected(repository);
      setPath('');
      setError(null);
    } catch (failure) {
      setError(messageOf(failure));
    }
  }

  return (
    <section aria-labelledby="repositories-heading" className="flex min-w-0 flex-col gap-2">
      <h3 id="repositories-heading" className="text-xs font-medium text-chalk-400">
        Repositorios de {selectedProject.name}
      </h3>

      {selectedProject.repositories.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-1.5">
          {selectedProject.repositories.map((repository) => (
            <li key={repository.id}>
              {/* El nombre accesible es solo la ruta: el estado va aparte para no contaminarlo. */}
              <button
                type="button"
                aria-label={repository.path}
                onClick={() => onRepositorySelected(repository)}
                className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-ink-700 bg-ink-850 px-2 py-1 font-mono text-[11px] text-chalk-200 transition-colors hover:border-ink-600 hover:text-chalk-50"
              >
                {repository.path}
                <StatePill state={repository.accessState} dense aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={submit} className="flex items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="sr-only">Ruta del repositorio</span>
          <input
            aria-label="Ruta del repositorio"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            required
            placeholder="/ruta/al/repositorio"
            className={`${inputStyles} w-72 font-mono text-xs`}
          />
        </label>
        <Button type="submit">Asociar repositorio</Button>
      </form>

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
