import { useState } from 'react';

import { Button } from '../../design/Button';
import { requestCancellation, retryExecution, type RuntimeExecution } from './runtimeApi';

interface ExecutionControlsProps {
  readonly execution: RuntimeExecution;
  readonly onUpdated: (execution: RuntimeExecution) => void;
}

export function ExecutionControls({ execution, onUpdated }: ExecutionControlsProps) {
  const [message, setMessage] = useState('');
  const terminal = execution.state === 'COMPLETED' || execution.state === 'FAILED' || execution.state === 'CANCELLED';

  async function cancel() {
    setMessage('Solicitando cancelación; se mantiene el último estado hasta confirmación.');
    try {
      onUpdated(await requestCancellation(execution.id));
    } catch {
      setMessage('No se pudo solicitar la cancelación local.');
    }
  }

  async function retry() {
    try {
      onUpdated(await retryExecution(execution.id));
    } catch {
      setMessage('El reintento requiere una acción manual válida.');
    }
  }

  return (
    <section aria-label="Controles de ejecución" className="flex flex-col gap-2">
      <p className="text-[11px] text-chalk-600">
        Último estado: {execution.knownState}. Efectos: {execution.effects.length}.
      </p>
      {message ? (
        <p role="status" className="text-[11px] text-chalk-400">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="danger"
          disabled={terminal || execution.cancellationRequested}
          onClick={() => void cancel()}
        >
          Cancelar
        </Button>
        <Button size="sm" disabled={!terminal} onClick={() => void retry()}>
          Reintentar manualmente
        </Button>
      </div>
    </section>
  );
}
