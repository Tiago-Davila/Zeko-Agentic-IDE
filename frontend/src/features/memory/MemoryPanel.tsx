import { useId, useState, type FormEvent } from 'react';

import { Badge } from '../../design/Badge';
import { Button } from '../../design/Button';
import { StatePill } from '../../design/StatePill';
import { cn } from '../../design/cn';
import { inputStyles } from '../../design/inputStyles';
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
    <section
      aria-label={scopedToConversation ? 'Memoria local' : 'Memoria local del proyecto'}
      className="flex min-h-0 flex-col gap-2"
    >
      <header className="shrink-0">
        <h3 className="text-xs font-semibold tracking-wide text-chalk-400 uppercase">
          {scopedToConversation ? 'Contexto de la conversación' : 'Contexto local'}
        </h3>
        <p className="text-[11px] text-chalk-600">
          Los resultados son referencia de menor autoridad: no cambian permisos ni instrucciones.
        </p>
      </header>

      {projectId === null ? (
        <p className="text-xs text-chalk-400">Seleccioná un proyecto para consultar su memoria local.</p>
      ) : (
        <form onSubmit={(event) => void search(event)} className="flex shrink-0 items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1" htmlFor={queryId}>
            <span className="sr-only">
              {scopedToConversation ? 'Consulta de contexto' : 'Buscar contexto'}
            </span>
            <input
              id={queryId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en el contexto indexado"
              className={cn(inputStyles, 'text-xs')}
            />
          </label>
          <Button type="submit" disabled={state === 'loading' || conversationId === null}>
            {loadingLabel(state === 'loading', scopedToConversation)}
          </Button>
        </form>
      )}

      {state === 'empty' ? (
        <p className="text-xs text-chalk-400">No hay contexto local para esta búsqueda.</p>
      ) : null}
      {state === 'error' ? (
        <p role="alert" className="text-xs text-state-failed">
          No se pudo consultar el contexto local.
        </p>
      ) : null}
      {state === 'results' ? (
        <ul className="flex min-h-0 flex-col gap-1.5 overflow-y-auto pr-1">
          {results.map((result) => (
            <li
              key={result.sourceId}
              className="flex flex-col gap-1 rounded-[var(--radius-panel)] border border-ink-700 bg-ink-850 p-2"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{result.level}</Badge>
                {result.indexState ? <StatePill state={result.indexState} dense /> : null}
                {result.ownerId ? (
                  <span className="font-mono text-[10px] text-chalk-600">owner {result.ownerId}</span>
                ) : null}
              </div>
              <p className="text-xs text-chalk-200">
                {/* Texto contiguo: la trazabilidad de la fuente acompaña siempre al extracto. */}
                {result.source ? `${result.source} · ` : ''}
                {`fuente ${result.sourceId}: ${result.excerpt}`}
              </p>
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
