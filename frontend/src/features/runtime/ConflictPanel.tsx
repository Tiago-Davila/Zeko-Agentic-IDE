import { useState } from 'react';
import type { RuntimeConflict } from './runtimeApi';

type Resolution = 'CANCELLED' | 'REASSIGNED' | 'RESOLVED_MANUALLY';

interface ConflictPanelProps {
  readonly conflict: RuntimeConflict;
  readonly onResolve?: (resolution: Resolution, note: string) => Promise<void> | void;
}

export function ConflictPanel({ conflict, onResolve }: ConflictPanelProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function resolve(resolution: Resolution) {
    if (onResolve === undefined) return;
    setBusy(true);
    setMessage('');
    try {
      await onResolve(resolution, note);
      setMessage('Resolución registrada localmente.');
    } catch {
      setMessage('No se pudo registrar la resolución local.');
    } finally {
      setBusy(false);
    }
  }

  return <section aria-label="Conflicto de worktree"><h3>Conflicto bloqueante</h3><p>La tarea {conflict.taskId} está {conflict.state}. Los cambios existentes se preservan.</p><p>Recursos: {conflict.resources.join(', ')}</p><label>Nota manual<input value={note} onChange={(event) => setNote(event.target.value)} /></label>{message ? <p role="status">{message}</p> : null}<button type="button" disabled={busy} onClick={() => void resolve('CANCELLED')}>Cancelar tarea</button><button type="button" disabled={busy} onClick={() => void resolve('REASSIGNED')}>Reasignar</button><button type="button" disabled={busy} onClick={() => void resolve('RESOLVED_MANUALLY')}>Registrar resolución manual</button></section>;
}
