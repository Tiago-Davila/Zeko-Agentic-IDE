import { useState } from 'react';
import { searchMemory, type MemoryResult } from './memoryApi';

interface MemoryPanelProps {
  readonly projectId: string | null;
  readonly conversationId: string | null;
}

export function MemoryPanel({ projectId, conversationId }: MemoryPanelProps) {
  const [results, setResults] = useState<readonly MemoryResult[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [searched, setSearched] = useState(false);

  async function search() {
    if (!projectId || !conversationId || query.trim() === '') {
      return;
    }
    try {
      const response = await searchMemory(projectId, conversationId, query);
      setResults(response.results);
      setSearched(true);
      setMessage('');
    } catch {
      setResults([]);
      setSearched(true);
      setMessage('No se pudo consultar el contexto local.');
    }
  }

  return (
    <section aria-label="Memoria local">
      <h3>Contexto local</h3>
      <label>
        Consulta de contexto
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <button type="button" disabled={!projectId || !conversationId || query.trim() === ''} onClick={() => void search()}>
        Buscar
      </button>
      {message ? <p role="alert">{message}</p> : null}
      {searched && !message && results.length === 0 ? <p role="status">No hay contexto permitido para esta conversación.</p> : null}
      <ul aria-label="Resultados de contexto">
        {results.map((result) => (
          <li key={result.sourceId}>
            {result.level} · {result.source} · owner {result.ownerId} · {result.indexState}
            {result.excerpt ? `: ${result.excerpt}` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
