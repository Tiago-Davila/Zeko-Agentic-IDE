import { useState } from 'react';

export interface RuntimeConflict { readonly taskId: string; readonly state: string; readonly resolution?: string; }

export function ConflictPanel({ conflict, onResolve }: { readonly conflict: RuntimeConflict; readonly onResolve?: (resolution: 'CANCELLED' | 'REASSIGNED' | 'RESOLVED_MANUALLY') => void }) {
  const [note, setNote] = useState('');
  return <section aria-label="Conflicto de worktree"><h3>Conflicto bloqueante</h3><p>La tarea {conflict.taskId} está {conflict.state}. Los cambios existentes se preservan.</p><label>Nota manual<input value={note} onChange={(event) => setNote(event.target.value)} /></label><button type="button" onClick={() => onResolve?.('CANCELLED')}>Cancelar tarea</button><button type="button" onClick={() => onResolve?.('REASSIGNED')}>Reasignar</button><button type="button" onClick={() => onResolve?.('RESOLVED_MANUALLY')}>Registrar resolución manual</button></section>;
}
