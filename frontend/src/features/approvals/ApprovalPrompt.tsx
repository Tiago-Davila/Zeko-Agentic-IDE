import { useState } from 'react';

import { Button } from '../../design/Button';
import { StatePill } from '../../design/StatePill';
import { decideApproval, type ApprovalDto } from './approvalApi';

interface ApprovalPromptProps {
  readonly approval: ApprovalDto;
  readonly onUpdated?: (approval: ApprovalDto) => void;
}

export function ApprovalPrompt({ approval, onUpdated }: ApprovalPromptProps) {
  const [current, setCurrent] = useState(approval);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const actionable = current.state === 'PENDING' && !busy;

  async function decide(decision: 'APPROVE' | 'DENY') {
    setBusy(true);
    setMessage('');
    try {
      const updated = await decideApproval(current.id, current.actionRevision, decision);
      setCurrent(updated);
      onUpdated?.(updated);
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? (error as { readonly status?: number }).status
        : undefined;
      setMessage(status === 409
        ? 'La solicitud quedó obsoleta; revisá la acción vigente antes de decidir.'
        : 'No se pudo registrar la decisión local.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Solicitud de aprobación"
      className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-state-waiting/40 bg-state-waiting/5 p-3"
    >
      <header className="flex items-center gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-state-waiting uppercase">
          Aprobación requerida
        </h3>
        <StatePill state={current.state} className="ml-auto" />
      </header>

      <dl className="flex flex-col gap-1 text-[11px]">
        <Row term="Acción">{current.action}</Row>
        <Row term="Recurso" mono>
          {current.resource}
        </Row>
        <Row term="Alcance">{current.scope}</Row>
        <Row term="Efectos esperados">{current.effects.join(', ') || 'No especificados'}</Row>
      </dl>

      <p className="text-[11px] text-chalk-400">
        Revisión: {current.actionRevision} · estado {current.state}
      </p>

      {current.state === 'INVALIDATED' ? (
        <p role="status" className="text-[11px] text-chalk-400">
          La acción fue invalidada por una revisión nueva.
        </p>
      ) : null}
      {message ? (
        <p role="alert" className="text-[11px] text-state-failed">
          {message}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" variant="primary" disabled={!actionable} onClick={() => void decide('APPROVE')}>
          Aceptar
        </Button>
        <Button size="sm" variant="danger" disabled={!actionable} onClick={() => void decide('DENY')}>
          Denegar
        </Button>
      </div>
    </section>
  );
}

function Row({ term, mono = false, children }: { readonly term: string; readonly mono?: boolean; readonly children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-chalk-600">{term}:</dt>
      <dd className={`min-w-0 break-words text-chalk-200 ${mono ? 'font-mono' : ''}`}>{children}</dd>
    </div>
  );
}
