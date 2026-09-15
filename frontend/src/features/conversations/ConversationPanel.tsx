import { useState, type FormEvent } from 'react';
import { MemoryPanel } from '../memory/MemoryPanel';
import {
  createProjectManagerConversation,
  sendMessage,
  type ConversationDto,
  type InstructionDto,
} from './conversationApi';

export function ConversationPanel({ projectId }: { readonly projectId: string | null }) {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<ConversationDto | null>(null);
  const [history, setHistory] = useState<readonly InstructionDto[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function openProjectManagerConversation() {
    if (!projectId) {
      return;
    }
    try {
      setConversation(await createProjectManagerConversation(projectId));
      setHistory([]);
      setError('');
    } catch {
      setError('No se pudo abrir la conversación local.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!projectId || !content || busy) return;
    setBusy(true);
    setError('');
    try {
      const active = conversation?.projectId === projectId
        ? conversation
        : await createProjectManagerConversation(projectId);
      const exchange = await sendMessage(active.id, content);
      setConversation(active);
      setHistory(exchange.conversation.instructions);
      setMessage('');
    } catch {
      setError('No se pudo enviar la instrucción al backend local.');
    } finally {
      setBusy(false);
    }
  }

  const activeConversation = conversation?.projectId === projectId ? conversation : null;

  return (
    <section aria-label="Conversación">
      <h3>Conversación con PM o agente</h3>
      <p>Podés instruir directamente al PM o a un agente; el origen queda trazado.</p>
      {projectId === null ? <p>Seleccioná un proyecto para conversar.</p> : (
        <>
          <button type="button" onClick={() => void openProjectManagerConversation()}>
            Abrir conversación con PM
          </button>
          {activeConversation ? <p role="status">Conversación activa con PM.</p> : null}
          <div aria-live="polite">
            {history.map((item) => (
              <p key={item.id} data-origin={item.origin}>
                <strong>{item.origin === 'USER' ? 'Vos' : 'Agente'}:</strong> {item.content}
              </p>
            ))}
          </div>
          <form onSubmit={(event) => void submit(event)}>
            <label>
              Instrucción
              <input aria-label="Instrucción" value={message} disabled={busy} onChange={(event) => setMessage(event.target.value)} />
            </label>
            <button type="submit" disabled={busy || message.trim().length === 0}>
              {busy ? 'Enviando…' : 'Enviar instrucción'}
            </button>
          </form>
          {error ? <p role="alert">{error}</p> : null}
          <MemoryPanel projectId={projectId} conversationId={activeConversation?.id ?? null} />
        </>
      )}
    </section>
  );
}
