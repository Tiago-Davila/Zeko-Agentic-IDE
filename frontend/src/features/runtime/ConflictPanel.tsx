import { useState } from 'react';

import { Button } from '../../design/Button';
import { StatePill } from '../../design/StatePill';
import { inputStyles } from '../../design/inputStyles';
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

  return (
    <section
      aria-label="Conflicto de worktree"
      className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-state-blocked/40 bg-state-blocked/5 p-3"
    >
      <header className="flex items-center gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-state-blocked uppercase">
          Conflicto bloqueante
        </h3>
        <StatePill state={conflict.state} className="ml-auto" />
      </header>

      <p className="text-[11px] text-chalk-400">
        La tarea {conflict.taskId} está {conflict.state}. Los cambios existentes se preservan.
      </p>
      <p className="text-[11px] break-words text-chalk-600">
        Recursos: <span className="font-mono">{conflict.resources.join(', ')}</span>
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-chalk-400">Nota manual</span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={`${inputStyles} text-xs`}
        />
      </label>

      {message ? (
        <p role="status" className="text-[11px] text-chalk-400">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="danger" disabled={busy} onClick={() => void resolve('CANCELLED')}>
          Cancelar tarea
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void resolve('REASSIGNED')}>
          Reasignar
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void resolve('RESOLVED_MANUALLY')}>
          Registrar resolución manual
        </Button>
      </div>
    </section>
  );
}
