import { useState } from 'react';
import { requestCancellation, retryExecution, type RuntimeExecution } from './runtimeApi';

export function ExecutionControls({ execution, onUpdated }: { readonly execution: RuntimeExecution; readonly onUpdated: (execution: RuntimeExecution) => void }) {
  const [message, setMessage] = useState('');
  const terminal = execution.state === 'COMPLETED' || execution.state === 'FAILED' || execution.state === 'CANCELLED';
  async function cancel() { setMessage('Solicitando cancelación; se mantiene el último estado hasta confirmación.'); try { onUpdated(await requestCancellation(execution.id)); } catch { setMessage('No se pudo solicitar la cancelación local.'); } }
  async function retry() { try { onUpdated(await retryExecution(execution.id)); } catch { setMessage('El reintento requiere una acción manual válida.'); } }
  return <section aria-label="Controles de ejecución"><p>Último estado: {execution.knownState}. Efectos: {execution.effects.length}.</p>{message ? <p role="status">{message}</p> : null}<button type="button" disabled={terminal || execution.cancellationRequested} onClick={() => void cancel()}>Cancelar</button><button type="button" disabled={!terminal} onClick={() => void retry()}>Reintentar manualmente</button></section>;
}
