import { useEffect, useState } from 'react';
import { traces, type TraceDto } from './traceApi';

export function TracePanel({ resourceId }: { readonly resourceId: string }) {
  const [items, setItems] = useState<readonly TraceDto[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void traces(resourceId).then(setItems).catch(() => setError('No se pudo cargar la evidencia local.')); }, [resourceId]);
  if (error) return <p role="alert">{error}</p>;
  return <section aria-label="Evidencia trazable"><h3>Vínculos de evidencia</h3><ul>{items.map((item) => <li key={`${item.sourceId}-${item.targetId}`}>{item.relation}: {item.sourceId} → {item.targetId}</li>)}</ul></section>;
}
