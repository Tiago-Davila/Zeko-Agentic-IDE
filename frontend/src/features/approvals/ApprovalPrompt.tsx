import { useState } from 'react';
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
    <section aria-label="Solicitud de aprobación">
      <h3>Aprobación requerida</h3>
      <p><strong>Acción:</strong> {current.action}</p>
      <p><strong>Recurso:</strong> {current.resource}</p>
      <p><strong>Alcance:</strong> {current.scope}</p>
      <p><strong>Efectos esperados:</strong> {current.effects.join(', ') || 'No especificados'}</p>
      <p><strong>Revisión:</strong> {current.actionRevision} · estado {current.state}</p>
      {current.state === 'INVALIDATED' ? <p role="status">La acción fue invalidada por una revisión nueva.</p> : null}
      {message ? <p role="alert">{message}</p> : null}
      <button type="button" disabled={!actionable} onClick={() => void decide('APPROVE')}>Aceptar</button>
      <button type="button" disabled={!actionable} onClick={() => void decide('DENY')}>Denegar</button>
    </section>
  );
}
