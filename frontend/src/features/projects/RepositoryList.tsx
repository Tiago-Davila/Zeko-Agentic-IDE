import { useState, type FormEvent } from 'react';

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
    return <p>Elegí un proyecto para asociar repositorios.</p>;
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
    <section aria-labelledby="repositories-heading">
      <h3 id="repositories-heading">Repositorios de {selectedProject.name}</h3>
      <ul>
        {selectedProject.repositories.map((repository) => (
          <li key={repository.id}>
            <button type="button" onClick={() => onRepositorySelected(repository)}>
              {repository.path}
            </button>{' '}
            <span>{repository.accessState}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit}>
        <label>
          Ruta del repositorio
          <input value={path} onChange={(event) => setPath(event.target.value)} required />
        </label>
        <button type="submit">Asociar repositorio</button>
      </form>
      {error === null ? null : <p role="alert">{error}</p>}
    </section>
  );
}

function messageOf(failure: unknown): string {
  return failure instanceof HttpClientError ? failure.message : 'No se pudo asociar el repositorio';
}
