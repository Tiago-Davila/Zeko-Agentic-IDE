import { useEffect, useState } from 'react';

import { traces, type TraceDto } from './traceApi';

export function TracePanel({ resourceId }: { readonly resourceId: string }) {
  const [items, setItems] = useState<readonly TraceDto[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void traces(resourceId).then(setItems).catch(() => setError('No se pudo cargar la evidencia local.'));
  }, [resourceId]);

  if (error) {
    return (
      <p role="alert" className="text-[11px] text-state-failed">
        {error}
      </p>
    );
  }

  return (
    <section aria-label="Evidencia trazable" className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold tracking-wide text-chalk-400 uppercase">
        Vínculos de evidencia
      </h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-chalk-600">Sin vínculos registrados para este recurso.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li
              key={`${item.sourceId}-${item.targetId}`}
              className="rounded-[var(--radius-control)] border border-ink-700 bg-ink-850 px-2 py-1 text-[10px]"
            >
              <span className="font-medium text-chalk-200">{item.relation}</span>
              <span className="text-chalk-600">
                : <span className="font-mono">{item.sourceId}</span> →{' '}
                <span className="font-mono">{item.targetId}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
