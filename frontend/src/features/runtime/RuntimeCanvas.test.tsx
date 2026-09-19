import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeCanvas } from './RuntimeCanvas';
import { runtimeSnapshot } from './runtimeApi';

vi.mock('./runtimeApi', () => ({ runtimeSnapshot: vi.fn(async () => []) }));

describe('RuntimeCanvas', () => {
  afterEach(cleanup);
  it('keeps the runtime canvas observational', () => {
    render(<RuntimeCanvas />);
    expect(screen.getByLabelText('Runtime Canvas').textContent).toContain('observacional');
  });

  it('shows a snapshot error separately from an empty project', async () => {
    vi.mocked(runtimeSnapshot).mockRejectedValueOnce(new Error('offline'));
    render(<RuntimeCanvas projectId="project-1" />);
    await waitFor(() => expect(screen.getAllByRole('alert').some((item) => item.textContent?.includes('No se pudo cargar'))).toBe(true));
    expect(screen.queryByText('No hay ejecuciones conocidas para este proyecto.')).toBeNull();
  });
});
