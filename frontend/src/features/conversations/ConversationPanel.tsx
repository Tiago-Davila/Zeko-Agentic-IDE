import { useState } from 'react';
import { MemoryPanel } from '../memory/MemoryPanel';
import { createProjectManagerConversation, type ConversationDto } from './conversationApi';

export function ConversationPanel({ projectId }: { readonly projectId: string | null }) {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<ConversationDto | null>(null);
  const [error, setError] = useState('');

  async function openProjectManagerConversation() {
    if (!projectId) {
      return;
    }
    try {
      setConversation(await createProjectManagerConversation(projectId));
      setError('');
    } catch {
      setError('No se pudo abrir la conversación local.');
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
          {error ? <p role="alert">{error}</p> : null}
          <form onSubmit={(event) => { event.preventDefault(); setMessage(''); }}>
            <label>
              Instrucción
              <input aria-label="Instrucción" value={message} onChange={(event) => setMessage(event.target.value)} />
            </label>
            <button type="submit">Enviar instrucción</button>
          </form>
          <MemoryPanel projectId={projectId} conversationId={activeConversation?.id ?? null} />
        </>
      )}
    </section>
  );
}
