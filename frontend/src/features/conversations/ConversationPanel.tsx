import { useState, type FormEvent, type KeyboardEvent } from 'react';

import { Badge } from '../../design/Badge';
import { Button } from '../../design/Button';
import { EmptyState } from '../../design/EmptyState';
import { cn } from '../../design/cn';
import { inputStyles } from '../../design/inputStyles';
import { MemoryPanel } from '../memory/MemoryPanel';
import {
  createProjectManagerConversation,
  sendMessage,
  type ConversationDto,
  type InstructionDto,
} from './conversationApi';

/*
 * Estilo por origen. El orden refleja la precedencia del dominio:
 * DEFAULT < SKILL < AGENT < PROJECT_MANAGER < PROJECT_RULES < USER.
 * Cuanta mas autoridad, mas saturado el acento.
 */
const origins: Readonly<Record<string, { readonly label: string; readonly bubble: string; readonly tag: string }>> = {
  USER: {
    label: 'Vos',
    bubble: 'border-spray-lime/40 bg-spray-lime/10',
    tag: 'text-spray-lime',
  },
  PROJECT_RULES: {
    label: 'Reglas del proyecto',
    bubble: 'border-spray-magenta/40 bg-spray-magenta/10',
    tag: 'text-spray-magenta',
  },
  PROJECT_MANAGER: {
    label: 'Project Manager',
    bubble: 'border-spray-violet/40 bg-spray-violet/10',
    tag: 'text-spray-violet',
  },
  AGENT: {
    label: 'Agente',
    bubble: 'border-spray-cyan/40 bg-spray-cyan/10',
    tag: 'text-spray-cyan',
  },
  SKILL: {
    label: 'Skill',
    bubble: 'border-ink-600 bg-ink-850',
    tag: 'text-chalk-400',
  },
  DEFAULT: {
    label: 'Por defecto',
    bubble: 'border-ink-700 bg-ink-850',
    tag: 'text-chalk-600',
  },
};

function originOf(origin: string) {
  return origins[origin] ?? origins.DEFAULT;
}

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

  // Enter envía; Shift+Enter agrega una línea.
  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  const activeConversation = conversation?.projectId === projectId ? conversation : null;

  return (
    <section aria-label="Conversación" className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-chalk-400 uppercase">
          Conversación con PM o agente
        </h3>
        {activeConversation ? (
          <Badge tone="accent">PM</Badge>
        ) : null}
        <p className="w-full text-[11px] text-chalk-600">
          Podés instruir directamente al PM o a un agente; el origen queda trazado.
        </p>
      </header>

      {projectId === null ? (
        <EmptyState title="Seleccioná un proyecto para conversar." />
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={() => void openProjectManagerConversation()}>
              Abrir conversación con PM
            </Button>
            {activeConversation ? (
              <p role="status" className="text-[11px] text-state-completed">
                Conversación activa con PM.
              </p>
            ) : null}
          </div>

          <div aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="text-[11px] text-chalk-600">
                Todavía no hay instrucciones en esta conversación.
              </p>
            ) : (
              history.map((item) => {
                const tone = originOf(item.origin);
                const mine = item.origin === 'USER';
                return (
                  <article
                    key={item.id}
                    data-origin={item.origin}
                    className={cn('flex max-w-[85%] flex-col gap-1', mine ? 'items-end self-end' : 'items-start self-start')}
                  >
                    <span className={cn('flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase', tone.tag)}>
                      {tone.label}
                      {item.overrideOf === null ? null : (
                        <span className="font-normal text-chalk-600 normal-case">· override</span>
                      )}
                    </span>
                    <p
                      className={cn(
                        'rounded-[var(--radius-panel)] border px-2.5 py-1.5 text-xs whitespace-pre-wrap text-chalk-100',
                        tone.bubble,
                      )}
                    >
                      {item.content}
                    </p>
                  </article>
                );
              })
            )}
          </div>

          <form onSubmit={(event) => void submit(event)} className="flex shrink-0 items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="sr-only">Instrucción</span>
              <textarea
                aria-label="Instrucción"
                value={message}
                disabled={busy}
                rows={2}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder="Escribí una instrucción. Enter envía, Shift+Enter agrega una línea."
                className={cn(inputStyles, 'h-auto resize-none py-1.5 text-xs')}
              />
            </label>
            <Button type="submit" variant="primary" disabled={busy || message.trim().length === 0}>
              {busy ? 'Enviando…' : 'Enviar instrucción'}
            </Button>
          </form>

          {error ? (
            <p role="alert" className="shrink-0 text-[11px] text-state-failed">
              {error}
            </p>
          ) : null}

          <MemoryPanel projectId={projectId} conversationId={activeConversation?.id ?? null} />
        </>
      )}
    </section>
  );
}
