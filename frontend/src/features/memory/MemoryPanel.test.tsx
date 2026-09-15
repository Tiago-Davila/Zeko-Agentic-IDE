import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryPanel } from './MemoryPanel';
import { searchMemory } from './memoryApi';

vi.mock('./memoryApi', () => ({ searchMemory: vi.fn() }));

describe('MemoryPanel', () => {
  afterEach(cleanup);

  it('requires an active conversation before searching local context', () => {
    render(<MemoryPanel projectId="project" conversationId={null} />);

    expect((screen.getByRole('button', { name: 'Buscar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows safe source metadata returned for the active conversation', async () => {
    vi.mocked(searchMemory).mockResolvedValue({
      results: [{
        sourceId: 'source',
        level: 'CONVERSATION',
        ownerId: 'conversation',
        source: 'context.md',
        indexState: 'CURRENT',
        excerpt: 'Contexto permitido',
      }],
    });
    render(<MemoryPanel projectId="project" conversationId="conversation" />);

    fireEvent.change(screen.getByLabelText('Consulta de contexto'), {
      target: { value: 'contexto' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(searchMemory).toHaveBeenCalledWith('project', 'conversation', 'contexto');
    });
    expect(screen.getByText(/CONVERSATION · context.md · owner conversation · CURRENT/)).not.toBeNull();
  });
});
