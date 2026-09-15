import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationPanel } from './ConversationPanel';

describe('ConversationPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('creates an explicit PM conversation before exposing its memory context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const correlation = new Headers(init?.headers).get('X-Correlation-Id') ?? '';
      const body = path.includes('/projects/')
        ? { id: 'conversation', projectId: 'project', recipientType: 'PM', recipientId: 'project' }
        : {};
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlation },
      });
    });

    render(<ConversationPanel projectId="project" />);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversación con PM' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/project/conversations', expect.objectContaining({ method: 'POST' }),
    ));
    expect(screen.getByRole('status').textContent).toBe('Conversación activa con PM.');
    expect(screen.getByLabelText('Memoria local')).not.toBeNull();
  });

  it('sends the instruction and renders the local response history', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const correlation = new Headers(init?.headers).get('X-Correlation-Id') ?? '';
      let body: object = {};
      if (path.includes('/conversations/')) {
        body = {
          instruction: { id: 'user-1', origin: 'USER', content: 'Preparar el plan', precedence: 'USER', overrideOf: null },
          response: { id: 'agent-1', origin: 'PROJECT_MANAGER', content: 'Plan local listo', precedence: 'PROJECT_MANAGER', overrideOf: null },
          conversation: { id: 'conversation-1', projectId: 'project', recipientType: 'PM', recipientId: 'pm', instructions: [
            { id: 'user-1', origin: 'USER', content: 'Preparar el plan', precedence: 'USER', overrideOf: null },
            { id: 'agent-1', origin: 'PROJECT_MANAGER', content: 'Plan local listo', precedence: 'PROJECT_MANAGER', overrideOf: null },
          ] },
        };
      } else if (path.includes('/projects/')) {
        body = { id: 'conversation-1', projectId: 'project', recipientType: 'PM', recipientId: 'pm' };
      }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlation } });
    });

    render(<ConversationPanel projectId="project" />);
    fireEvent.change(screen.getByLabelText('Instrucción'), { target: { value: 'Preparar el plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar instrucción' }));

    await waitFor(() => expect(screen.getByText('Plan local listo')).not.toBeNull());
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/conversations/conversation-1/messages', expect.objectContaining({ method: 'POST' }));
  });
});
