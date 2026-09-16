import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { searchMemory } = vi.hoisted(() => ({ searchMemory: vi.fn() }));

vi.mock('./memoryApi', () => ({ searchMemory }));

import { MemoryPanel } from './MemoryPanel';

describe('MemoryPanel', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('explains that local context cannot grant authority without a project', () => {
    render(<MemoryPanel projectId={null} />);

    expect(screen.getByText('Contexto')).not.toBeNull();
    // La afirmacion de autoridad se conserva, en forma mas breve.
    expect(screen.getByText(/menor autoridad/i)).not.toBeNull();
    expect(screen.getByText(/Seleccioná un proyecto/i)).not.toBeNull();
  });

  it('distinguishes an empty search from a local search error', async () => {
    searchMemory.mockResolvedValueOnce({ results: [] }).mockRejectedValueOnce(new Error('offline'));
    render(<MemoryPanel projectId="project-1" />);

    fireEvent.change(screen.getByLabelText('Buscar contexto'), { target: { value: 'arquitectura' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(screen.getByText(/No hay contexto local/i)).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());
  });
});
