import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeCanvas } from './RuntimeCanvas';
import { runtimeProjectSnapshot } from './runtimeApi';

vi.mock('./runtimeApi', () => ({
  runtimeProjectSnapshot: vi.fn(),
  executionResult: vi.fn(async () => ({ attributableDiff: '', previousChanges: '' })),
  requestCancellation: vi.fn(),
  retryExecution: vi.fn(),
}));

describe('RuntimeCanvas', () => {
  afterEach(cleanup);
  it('keeps the runtime canvas observational', () => {
    render(<RuntimeCanvas projectId={null} />);
    expect(screen.getByLabelText('Runtime Canvas').textContent).toContain('observacional');
    expect((screen.getByRole('button', { name: 'Recargar estado' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks only an explicit failed provider as unavailable', async () => {
    vi.mocked(runtimeProjectSnapshot).mockResolvedValue({
      projectId: 'project-a',
      tasks: [],
      executions: [{
        id: 'execution-a',
        taskId: 'task-a',
        attempt: 1,
        state: 'FAILED',
        knownState: 'UNAVAILABLE',
        templateId: 'template-a',
        templateVersion: 1,
        retryOfExecutionId: null,
        provider: 'OLLAMA',
        cancellationRequested: false,
        effects: [],
      }, {
        id: 'execution-b',
        taskId: 'task-b',
        attempt: 1,
        state: 'FAILED',
        knownState: 'Docker no disponible',
        templateId: 'template-b',
        templateVersion: 1,
        retryOfExecutionId: null,
        provider: null,
        cancellationRequested: false,
        effects: [],
      }],
    });

    render(<RuntimeCanvas projectId="project-a" />);

    const providers = await screen.findByLabelText('Proveedores locales');
    expect(providers.textContent).toContain('Ollama: no disponible');
    expect(providers.textContent).toContain('Docker: estado desconocido');
    expect(runtimeProjectSnapshot).toHaveBeenCalledWith('project-a');
  });
});
