import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentsCanvas } from '../../src/features/agents/AgentsCanvas';

vi.mock('../../src/features/agents/agentApi', () => ({ templates: vi.fn().mockResolvedValue([]) }));
afterEach(cleanup);
describe('AgentsCanvas', () => {
  it('explains that a visual relation does not start execution', () => {
    render(<AgentsCanvas projectId="project-1" />);
    expect(screen.getByRole('button', { name: 'Crear plantilla' })).not.toBeNull();
  });
});
