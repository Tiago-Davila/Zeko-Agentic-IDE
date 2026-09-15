import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationPanel } from './ConversationPanel';
import { createProjectManagerConversation } from './conversationApi';

vi.mock('./conversationApi', () => ({ createProjectManagerConversation: vi.fn() }));

describe('ConversationPanel', () => {
  afterEach(cleanup);

  it('creates an explicit PM conversation before exposing its memory context', async () => {
    vi.mocked(createProjectManagerConversation).mockResolvedValue({
      id: 'conversation',
      projectId: 'project',
      recipientType: 'PM',
      recipientId: 'project',
    });
    render(<ConversationPanel projectId="project" />);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversación con PM' }));

    await waitFor(() => {
      expect(createProjectManagerConversation).toHaveBeenCalledWith('project');
    });
    expect(screen.getByRole('status').textContent).toBe('Conversación activa con PM.');
    expect(screen.getByLabelText('Memoria local')).not.toBeNull();
  });
});
