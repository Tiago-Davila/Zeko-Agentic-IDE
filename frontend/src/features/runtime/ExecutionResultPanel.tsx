import { useEffect, useState } from 'react';
import { DiffViewer } from './DiffViewer';
import { executionResult, type ExecutionResult } from './runtimeApi';

export function ExecutionResultPanel({ executionId }: { readonly executionId: string }) {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void executionResult(executionId).then(setResult).catch(() => setError('No se pudo cargar el resultado local.')); }, [executionId]);
  if (error) return <p role="alert">{error}</p>;
  if (!result) return <p>Cargando resultado confirmado…</p>;
  return <DiffViewer attributableDiff={result.attributableDiff} previousChanges={result.previousChanges} />;
}
