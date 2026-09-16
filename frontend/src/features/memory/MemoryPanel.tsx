import { useId, useState, type FormEvent } from 'react';

import { searchMemory, type MemoryResult } from './memoryApi';

interface MemoryPanelProps {
  readonly projectId: string | null;
  readonly conversationId?: string | null;
}

export function MemoryPanel({ projectId, conversationId }: MemoryPanelProps) {
  const [results, setResults] = useState<readonly MemoryResult[]>([]);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'empty' | 'error' | 'results'>('idle');
  const queryId = useId();
  // El panel se monta dos veces: acotado al proyecto y acotado a la conversación activa.
  const scopedToConversation = conversationId !== undefined;

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (projectId === null || value.length === 0 || (conversationId !== undefined && conversationId === null)) {
      return;
    }
    setState('loading');
    try {
      const response = conversationId === undefined
        ? await searchMemory(projectId, value)
        : await searchMemory(projectId, conversationId, value);
      setResults(response.results);
      setState(response.results.length === 0 ? 'empty' : 'results');
    } catch {
      setResults([]);
      setState('error');
    }
  }

  return (
    <section aria-label={scopedToConversation ? 'Memoria local' : 'Memoria local del proyecto'}>
      <h3>{scopedToConversation ? 'Contexto de la conversación' : 'Contexto local'}</h3>
      <p>Los resultados son referencia de menor autoridad: no cambian permisos ni instrucciones.</p>
      {projectId === null ? <p>Seleccioná un proyecto para consultar su memoria local.</p> : (
        <form onSubmit={(event) => void search(event)}>
          <label htmlFor={queryId}>{scopedToConversation ? 'Consulta de contexto' : 'Buscar contexto'}</label>
          <input
            id={queryId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" disabled={state === 'loading' || conversationId === null}>
            {loadingLabel(state === 'loading', scopedToConversation)}
          </button>
        </form>
      )}
      {state === 'empty' ? <p>No hay contexto local para esta búsqueda.</p> : null}
      {state === 'error' ? <p role="alert">No se pudo consultar el contexto local.</p> : null}
      {state === 'results' ? (
        <ul>
          {results.map((result) => (
            <li key={result.sourceId}>
              <strong>{result.level}</strong>{result.source ? ` · ${result.source}` : ''}
              {result.ownerId ? ` · owner ${result.ownerId}` : ''}
              {result.indexState ? ` · ${result.indexState}` : ''}
              {` · fuente ${result.sourceId}: ${result.excerpt}`}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function loadingLabel(loading: boolean, scopedToConversation: boolean): string {
  if (scopedToConversation) {
    return loading ? 'Consultando…' : 'Consultar contexto';
  }
  return loading ? 'Buscando…' : 'Buscar';
}
